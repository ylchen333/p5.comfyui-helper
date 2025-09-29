// this example workflow expects v1-5-pruned-emaonly.ckpt to be installed

let workflow;
let comfy;
let resImg;

window.addEventListener("error", (e) => {
  console.error("[global error]", e.message, e.filename, e.lineno, e.colno);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
});

function preload() {
  workflow = loadJSON("workflow_api.json");
  // there's no correlation between the workflow in the runcomfy session and the workflow 
  // loaded here. I believe we are just using the session to load 
  // the workflow we've uploaded here. 
  // Reminder: you can change certain fields in your workflow (random seed, prompt, etc)
  // from p5.js
  // additionally, this json must be obtained from turning dev mode on and 
  // saving the workflow as api format
}

function setup() {
  createCanvas(512, 512);

  // https://www.runcomfy.com/comfyui/89e60215-b0a1-4795-8437-e2743cddc806/servers/64c364bd-d7fa-4996-a44f-c08b4c5c02d6
  server_id = "64c364bd-d7fa-4996-a44f-c08b4c5c02d6";
  comfy_url = "https://" + server_id + "-comfyui.runcomfy.com";
  console.log("comfy url is " + comfy_url);
  comfy = new ComfyUiP5Helper(comfy_url); 
  // for every new workflow/runcomfy session, you need to update the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX server-id since this updates every new work session
  // aka the last XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX characters in the url
  // I would recommend setting your runcomfy session to be slightly longer than you anticipate
  // so that you don't need to reset this url each time and wait for the 5 min load up period
  // you can check that your url is correct, past <comfy_url> into your browser and it should display a comfyui
  // console.log("workflow is", workflow);

  let button = createButton('generate');
  button.mousePressed(requestImage);
}

function requestImage() {
  // we could make some changes to the workflow here,
  // such as changing the prompt or modifying the seed
  // workflow[16].inputs.seed = random(9999999);
  workflow[5].inputs.image = "combined_image_1980x1980.jpg"; //"DSC08228.jpeg";
  // image needs to exist on runcomfy using this method
  // "combined_image_1980x1980.jpg"

  comfy.run(workflow, gotImage);
  // do we only want one save image? currently it'll look at the save image with smallest node id
}

function gotImage(results, err) {
  // results is an array of outputs from running the workflow
  console.log("gotImage", results);

  // you can load them like so
  if (results.length > 0) {
    resImg = loadImage(results[0].src);
  }

  // we could automatically run again if we wanted
  //requestImage();
}

function draw() {
  background(255);
  // if we have an image, put it onto the canvas
  if (resImg) {
    image(resImg, 0, 0, width, height);
  }
}
