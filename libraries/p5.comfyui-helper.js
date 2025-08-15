/**
 * p5.comfyui-helper
 * (c) Gottfried Haider 2024
 * LGPL
 * https://github.com/gohai/p5.comfyui-helper
 */

"use strict";

class ComfyUiP5Helper {
  constructor(base_url) {
    this.base_url = base_url.replace(/\/$/, ""); // strip any trailing slash
    this.setup_websocket();
    this.outputs = [];

    this.running_prompts = {};
    this.running_uploads = {};
  }

  setup_websocket() {
    this.ws = new WebSocket(this.base_url + "/ws");
    this.ws.addEventListener("message", this.websocket_on_message.bind(this));
    this.ws.addEventListener("error", this.websocket_on_error.bind(this));
    this.ws.addEventListener("close", this.websocket_on_close.bind(this));
    this.sid = null; // invalidate for reconnection
  }

  async websocket_on_message(event) {
    if (typeof event.data == "string") {
      const data = JSON.parse(event.data);
      if (data.type == "status") {
        // ComfyUI sends the client id (once) after establishing the connection
        if (data.data.sid && !this.sid) {
          this.sid = data.data.sid;
        }
      } else if (data.type == "execution_start") {
        if (data.data.prompt_id == this.prompt_id) {
          //console.log("Execution starts");
        }
      } else if (data.type == "progress") {
        // this is being sent periodically during processing
        this.current_prompt = data.data.prompt_id;
        this.current_node = data.data.node;

        // if there's a status callback set up for the current prompt, run it
        if (this.running_prompts?.[this.current_prompt]?.status_callback) {
          this.running_prompts[this.current_prompt].status_callback(data.data);
        }
      } else if (data.type == "execution_success") {
        if (data.data.prompt_id == this.prompt_id) {
          //console.log("Execution finished");
          await this.get_outputs_from_history(this.prompt_id);
          if (this.callback) {
            this.callback(this.outputs);
          }
          this.resolve(this.outputs);
          this.outputs = [];
          delete this.running_prompts[this.current_prompt];
        }
      } else if (data.type == "execution_interrupted") {
        console.warn("Execution was interrupted");
        if (this.callback) {
          this.callback([], "Execution was interrupted");
        }
        this.reject("Execution was interrupted");
        this.outputs = [];
      } else if (data.type == "execution_error") {
        console.warn(data);
        if (this.callback) {
          this.callback([], "Error during execution");
        }
        this.reject("Error during execution");
      } else {
        //console.log(data);
      }
    }

    if (event.data instanceof Blob) {
      if (this.current_prompt == this.prompt_id) {
        const blob_url = URL.createObjectURL(event.data.slice(8));
        this.outputs.push({
          node: parseInt(this.current_node),
          src: blob_url,
        });
      }
    }
  }

  websocket_on_error(event) {
    console.warn(event);
    this.ws.close();
  }

  websocket_on_close(event) {
    setTimeout(() => {
      console.log("Reconnecting to " + this.base_url);
      this.setup_websocket();
    }, 1000);
  }

  async get_outputs_from_history(prompt_id) {
    try {
      let res = await fetch(this.base_url + "/history/" + prompt_id);
      let history = await res.json();

      history = history[prompt_id];

      // flatten resulting images and only use the ones of type 'output':
      let image_outputs = Object.entries(history.outputs)
        .filter(([key, value]) => value?.images?.length > 0)
        .reduce((acc, [key, value]) => {
          acc[key] = value.images.filter((d) => d.type === "output");
          return acc;
        }, {});

      for (const [node_number, images] of Object.entries(image_outputs)) {
        for (const image of images) {
          const img_encoded = new URLSearchParams(image);
          const blob_url =
            this.base_url + "/view?" + encodeURI(img_encoded.toString());

          this.outputs.push({
            node: parseInt(node_number),
            src: blob_url,
          });
        }
      }
    } catch (e) {
      console.warn(e);
      throw e;
    }
  }

  async run(workflow, callback, status_callback) {
    // stall while we're waiting for the Comfy connection being set up
    // as well as images being uploaded:
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
    while (!this.sid || Object.values(this.running_uploads).length > 0) {
      await delay(100);
    }

    this.callback = callback;
    this.prompt_id = await this.prompt(workflow, status_callback);
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  async prompt(workflow, status_callback) {
    let options = {
      method: "POST",
      body: JSON.stringify({ prompt: workflow, client_id: this.sid }),
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow",
    };

    try {
      let res = await fetch(this.base_url + "/prompt", options);
      let data = await res.json();
      if (res.status !== 200) {
        if (data.error) {
          throw (
            data.error.type +
            ": " +
            data.error.message +
            " (" +
            data.error.details +
            ")"
          );
        } else {
          throw "Status " + res.status;
        }
      }

      this.running_prompts[data.prompt_id] = { status_callback };

      return data.prompt_id;
    } catch (e) {
      console.warn(e);
      throw e;
    }
  }

  upload_canvas(canvas, filename) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          const formData = new FormData();
          formData.append("image", blob, filename);
          formData.append("type", "input");

          let options = {
            method: "POST",
            body: formData,
            redirect: "follow",
          };

          fetch(this.base_url + "/upload/image", options)
            .then((res) => res.json())
            .then((json) => {
              // console.log("Upload response:", json);
              resolve(json.name);
            })
            .catch((err) => {
              console.warn("Upload failed:", err);
              reject(err);
            });
        },
        "image/jpeg",
        0.95
      );
    });
  }

  image(img) {
    let filename;
    if (img.loadPixels) {
      img.loadPixels();
      let canvas = img.canvas;

      // generate a random filename:
      filename = "p5.comfyui-helper-";
      if (crypto) {
        filename += crypto.randomUUID();
      } else {
        filename += Math.random().toString(36).substring(2);
      }
      filename += ".jpg";

      // start upload:
      this.running_uploads[filename] = true;
      this.upload_canvas(canvas, filename).finally(() => {
        delete this.running_uploads[filename];
      });

      return filename;
    } else {
      throw "image() is currently only implemented for p5 Graphics/Renderer/Image objects";
    }
  }
}
