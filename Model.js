

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


function Vertex(p)
{
    this.p = p;
    this.normal = [];
    this.triangles = [];
}

function Triangle(v0, v1, v2)
{
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.normal = [];
    this.tangent = [];
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, indices) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STREAM_DRAW);

        this.count = indices.length;
    }

    this.Draw = function() {

        //gl.drawArrays(gl.LINE_STRIP, 0, this.count);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }

    this.DrawWireframe = function() {

        for (let p=0; p<this.count; p+=3)                    // offset in bytes (UNSIGNED_SHORT is two bytes)
            gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, p*2);
    }
}

 function CreateSurfaceData(data) {
    const rMin = 0.1, rMax = 4;
    const rCount = 100, tCount = 200;
    const scale = 0.4;
    const p = 8;

    let vertices = [];
    let indices = [];

    
    for (let i = 0; i <= rCount; i++) {
        let r = rMin + (rMax - rMin) * i / rCount;
        let z = (1 / r - r) / (1 + Math.pow(scale / r, p));

        // let z = 1 / r - r;
        

        for (let j = 0; j <= tCount; j++) {
            let theta = 2 * Math.PI * j / tCount;
            let x = r * Math.cos(theta);
            let y = r * Math.sin(theta);

            vertices.push(x * scale, y * scale, z * scale);
        }
    }

    for (let i = 0; i < rCount; i++) {
        for (let j = 0; j < tCount; j++) {
            let row1 = i * (tCount + 1);
            let row2 = (i + 1) * (tCount + 1);

            indices.push(row1 + j, row2 + j, row2 + j + 1);
            indices.push(row1 + j, row2 + j + 1, row1 + j + 1);
        }
    }

    data.verticesF32 = new Float32Array(vertices);
    data.indicesU16 = new Uint16Array(indices);
}