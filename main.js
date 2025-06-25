'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let surfaceWebCam;              // A substrate for webcam image
let shProgramWebCam;            // A shader program for webcam
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

let iTextureWebCam = -1;

let video;

let guiParams = {
    eyeSeparation: 0.7,
    fov: 0.4,
    near: 8.0,
    convergence: 14.0
};

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

// Update stereoCam parameters from UI
function updateStereoCam() {
    stereoCam.eyeSeparation = guiParams.eyeSeparation;
    stereoCam.fov = guiParams.fov;
    stereoCam.near = guiParams.near;
    stereoCam.convergence = guiParams.convergence;
}

function drawWebCamSurface() {
    if (iTextureWebCam < 0) return;

    gl.useProgram(shProgram.prog);

    // Setup orthographic projection for zero parallax
    let matrOrth = m4.orthographic(0, 1, 0, 1, 8, 20);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrOrth);

    // Identity modelview for webcam quad
    let identity = m4.identity();
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, identity);

    // Bind webcam texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, iTextureWebCam);

    // Draw the webcam quad
    surfaceWebCam.Draw();
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


       gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);

    shProgramWebCam.Use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, iTextureWebCam);
    gl.uniform1i(shProgramWebCam.iSampler, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // Draw webcam surface at zero parallax
    drawWebCamSurface();

    shProgram.Use();

    updateStereoCam();

    // Get the view matrix from the SimpleRotator object.
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    const colorPolygon = new Float32Array([0.5,0.5,0.5,1]);
    const colorEdge    = new Float32Array([1,1,1,1]);

    // The FIRST PASS (for the left eye)
    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    console.log(stereoCam.near);

    let translateLeftEye = m4.translation(stereoCam.eyeSeparation/2, stereoCam.fov/2, stereoCam.near/10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0 );
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1 );
        
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1,0);

    // Draw filled polygons (red channel)
    gl.colorMask(true, false, false, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();

    // Draw wireframe (red channel)
    gl.polygonOffset(-1, -1); // Pull wireframe forward
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // The SECOND PASS (for the right eye)
    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4.translation(-stereoCam.eyeSeparation/2, -stereoCam.fov/2, -stereoCam.near/10);

    matAccum0 = m4.multiply(rotateToPointZero, modelView );
    matAccum1 = m4.multiply(translateRightEye, matAccum0 );
    matAccum2 = m4.multiply(translateToPointZero, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    // Draw filled polygons (cyan channel)
    gl.colorMask(false, true, true, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();

    // Draw wireframe (cyan channel)
    gl.polygonOffset(-1, -1);
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // RESET specific params to their default state

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}



/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    let data = {};
    
    CreateSurfaceData(data)

    surface = new Model('Kiss surface');
    surface.BufferData(data.verticesF32, data.indicesU16);

    surfaceWebCam = new Model('SurfaceWebCam');

    let progWebCam = createProgram(gl, vertexShaderWebCamSource, fragmentShaderWebCamSource);
    shProgramWebCam = new ShaderProgram('WebCam', progWebCam);
    shProgramWebCam.Use();

    shProgramWebCam.iSampler = gl.getUniformLocation(progWebCam, "video");

    stereoCam = new StereoCamera(
        .7,     // decimeters
        14.0,   // decimeters
        1.3,    // aspect ratio of canvas
        0.4,    // radians
        8.0,    // decimeters
        20.0    // decimeters
    );

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl2");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    video = document.createElement('video');
    video.autoplay = true;

    // Connect to video stream
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        iTextureWebCam = CreateWebCamTexture(settings.width, settings.height);

        video.play();
    })
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    });

    setInterval(draw, 1/20 * 1000);

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();

     document.getElementById('eyeSeparation').addEventListener('input', function(e) {
        guiParams.eyeSeparation = parseFloat(e.target.value);
    });
    document.getElementById('fov').addEventListener('input', function(e) {
        guiParams.fov = parseFloat(e.target.value);
    });
    document.getElementById('near').addEventListener('input', function(e) {
        guiParams.near = parseFloat(e.target.value);
    });
    document.getElementById('convergence').addEventListener('input', function(e) {
        guiParams.convergence = parseFloat(e.target.value);
    });
}

function updateEyeSepValue(val) {
    document.getElementById('eyeSepValue').textContent = val;
    guiParams.eyeSeparation = parseFloat(val);
}
function updateFovValue(val) {
    document.getElementById('fovValue').textContent = val;
    guiParams.fov = parseFloat(val);
}
function updateNearValue(val) {
    document.getElementById('nearValue').textContent = val;
    guiParams.near = parseFloat(val);
}
function updateConvValue(val) {
    document.getElementById('convValue').textContent = val;
    guiParams.convergence = parseFloat(val);
}

// Ініціалізувати значення при старті
window.addEventListener('DOMContentLoaded', function() {
    updateEyeSepValue(document.getElementById('eyeSeparation').value);
    updateFovValue(document.getElementById('fov').value);
    updateNearValue(document.getElementById('near').value);
    updateConvValue(document.getElementById('convergence').value);
});
