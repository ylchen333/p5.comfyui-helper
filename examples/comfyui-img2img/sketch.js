// this example workflow expects sdxl_lightning_2step.safetensors to be installed
// based on https://comfyanonymous.github.io/ComfyUI_examples/img2img

let workflow;
let comfy;
let srcImg;
let resImg;

function preload() {
  workflow = loadJSON("workflow_api.json");
  // inputImg = loadImage("/workspace/ComfyUI/input/example.png");
}

function parse_runcomfy_url(url){
  // example url: 
  // https://www.runcomfy.com/comfyui/89e60215-b0a1-4795-8437-e2743cddc806/servers/64c364bd-d7fa-4996-a44f-c08b4c5c02d6
  // const url = url;

  // 1. Parse the URL
  const parsedUrl = new URL(url);

  // 2. Split the pathname to get the last segment (server_id)
  const parts = parsedUrl.pathname.split("/");
  const server_id = parts.pop(); // "64c364bd-d7fa-4996-a44f-c08b4c5c02d6"

  return server_id
}

function setup() {
  createCanvas(512, 512);
  pixelDensity(1);
  frameRate(2);
  srcImg = createGraphics(width, height);

  const url = "https://www.runcomfy.com/comfyui/89e60215-b0a1-4795-8437-e2743cddc806/servers/97d0223d-c62e-4c27-8844-d406ec40db7d"
  server_id = parse_runcomfy_url(url);
  comfy_url = "https://" + server_id + "-comfyui.runcomfy.com";
  console.log("comfy url is " + comfy_url);
  comfy = new ComfyUiP5Helper(comfy_url); 
  console.log("workflow is", workflow);


  let button = createButton("start generating");
  button.mousePressed(requestImage);
}

async function requestImage() {
  // Node 10 in this workflow is LoadImage
  const uploaded = await comfy.image(srcImg);
  workflow["10"].inputs.image = uploaded;

  if (!workflow["10"]) {
    console.error("❌ Node 10 not found in workflow!");
    return;
  }
  // replace the prompt
  workflow[6].inputs.text = "idylic beach scene with a white volleyball";
  // randomize the seed
  workflow[3].inputs.seed = workflow[3].inputs.seed + 1;

  comfy.run(workflow, gotImage);
}

function gotImage(data, err) {
  // data is an array of outputs from running the workflow
  console.log("gotImage", data);

  // you can load them like so
  if (data.length > 0) {
    resImg = loadImage(data[0].src);
  }

  // automatically run again
  requestImage();
}

function draw() {
  // draw a scene into the source image to use for generation
  srcImg.background(255, 150, 50); // sky
  srcImg.fill(0, 50, 150); // water
  srcImg.noStroke();
  srcImg.rect(0, height / 2, width, height / 2);
  srcImg.fill(255); // volleyball
  srcImg.noStroke();
  srcImg.ellipse(width / 2, 2*height/3, 150, 150);

  background(255);
  image(srcImg, 0, 0);
  //if we have an image, put it onto the canvas
  if (resImg) {
    image(resImg, 0, 0, width, height);
  }
}
