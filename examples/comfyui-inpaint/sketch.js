// this example workflow expects 512-inpainting-ema.safetensors to be installed
// based on 

let workflow;
let comfy;
let bg;
let srcImg;
let maskGraphics;
let resImg;

function preload() {
  workflow = loadJSON("workflow_inpaint_comfyui.json");
  bg = loadImage("yosemite.jpg");
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
  createCanvas(1024, 683);
  pixelDensity(1);
  srcImg = createGraphics(width, height);
  maskGraphics = createGraphics(width, height); 
  srcImg.clear();
  maskGraphics.background(0);

  const url = "https://www.runcomfy.com/comfyui/89e60215-b0a1-4795-8437-e2743cddc806/servers/e333cc10-3136-43dc-ac8e-d1b8e6294aa2"
  server_id = parse_runcomfy_url(url);
  comfy_url = "https://" + server_id + "-comfyui.runcomfy.com";
  console.log("comfy url is " + comfy_url);
  comfy = new ComfyUiP5Helper(comfy_url); 
  console.log("workflow is", workflow);

  let button = createButton("start generating");
  button.mousePressed(requestImage);
}

async function requestImage() {
  // replace the LoadImage node with our source image
  const uploaded = await comfy.image(srcImg);
  workflow["20"].inputs.image = uploaded;

  if (!workflow["20"]) {
    console.error("❌ Node 20 not found in workflow!");
    return;
  }

  workflow[6].inputs.text = "closeup photograph of maine coon (cat:1.2)";
  // update the seed
  workflow[3].inputs.seed = workflow[3].inputs.seed + 1;
  // reduce the number of steps (to make it faster)
  workflow[3].inputs.steps = 10;

  comfy.run(workflow, gotImage);
}

function gotImage(results, err) {
  // data is an array of outputs from running the workflow
  console.log("gotImage", results);

  // you can load them like so
  if (results.length > 0) {
    resImg = loadImage(results[0].src);
  }

  // automatically run again
  requestImage();
}


function draw() {
  // draw a scene into the source image
  srcImg.image(bg, 0, 0);

  // burn a "hole" with the mouse into the source image
  if (mouseIsPressed) {
    srcImg.erase();
    srcImg.circle(mouseX, mouseY, 100);
    srcImg.noErase();

    // draw the same circle in the mask (white = area to paint)
    maskGraphics.noStroke();
    maskGraphics.fill(255);
    maskGraphics.circle(mouseX, mouseY, 100);
  }

  // draw checkerboard background
  background(255);
  for (let y = 0; y < height; y += 10) {
    for (let x = 0; x < width; x += 10) {
      noStroke();
      fill(((x + y) / 10) % 2 === 0 ? 255 : 204);
      rect(x, y, 10, 10);
    }
  }

  // preview: overlay erased source and its mask
  image(srcImg, 0, 0);
  tint(255, 127); // semi-transparent
  image(maskGraphics, 0, 0);
  noTint();

  // draw result if we have one
  if (resImg) {
    image(resImg, 0, 0, width, height);
  }
}