#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");
const { detect } = require("detect-port");
const { WebSocketServer } = require("ws");

const currentDir = process.cwd(); // running current working directory!!

const getPortAndStartServer = async (port = 5000) => {
  const availablePort = await detect(port);

  const server = http.createServer((req, res) => {

    let urlPath = currentDir + req.url;

    fs.access(urlPath, fs.constants.F_OK, (err) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("404 Not Found");
      }
      else {
        fs.stat(urlPath, (err, stats) => {
          if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            return res.end("404 Not Found");
          }

          if(stats.isDirectory()) {
            const indexFilePath = path.join(urlPath, 'index.html');
            fs.access(indexFilePath, fs.constants.F_OK, (err) => {
              if(!err){
                fs.createReadStream(indexFilePath).pipe(res);

              }else {
                fs.readdir(urlPath, (err, files) => {
                  if(err) {
                    res.writeHead(500);
                    res.end('Error reading directory');
                  }
                  else {
                    res.writeHead(200, {
                      "content-type": "text/html",
                    });
                    console.log('current directory files', files)
                    // print all files inside directory
                    printAllFiles(res, req, files, urlPath);
                  }
                });
              }
            });
          }
          else if(stats.isFile()){
            // if files here
            serveFile(res, urlPath, availablePort);
          }
        });
      }

    });
  });

  server.listen(availablePort, () => {
    console.log(`Serving ${currentDir}`);
    console.log(`Server running at http://localhost:${availablePort}`);
  });

  // -------- Websocket --------
  const wss = new WebSocketServer({ server });

  function broadcastReload() {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send("reload");
      }
    });
  }

  // Watch any file changes
  fs.watch(".", { recursive: true }, (event, filename) => {
    if (filename && /\.(html|css|js)$/.test(filename)) {
      broadcastReload();
    }
  });
};

getPortAndStartServer();


// All files and folder shows
function printAllFiles(res, req, files, urlPath) {

res.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Directory Listing</title>
  <style>
    body {
      font-family: sans-serif;
      background: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    #wrapper {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px #ccc;
      max-width: 960px;
      margin: auto;
    }
    h1 {
      margin-top: 0;
      font-size: 24px;
      word-break: break-word;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      margin: 10px 0;
    }
    a {
      text-decoration: none;
      color: #333;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #fafafa;
      transition: all 0.2s ease;
      word-break: break-word;
    }
    a:hover {
      background: #eee;
    }
    .icon {
      margin-right: 10px;
    }
    .name {
      flex: 2;
      min-width: 40%;
    }
    .size {
      flex: 1;
      text-align: right;
      color: #666;
      font-size: 12px;
      min-width: 25%;
    }
    .date {
      flex: 1.5;
      text-align: right;
      color: #666;
      font-size: 12px;
      min-width: 35%;
    }

    @media (max-width: 600px) {
      a {
        flex-direction: column;
        align-items: flex-start;
      }
      .size, .date {
        text-align: left;
        font-size: 11px;
        margin-top: 4px;
      }
      .name {
        font-weight: bold;
      }
    }
  </style>
</head>
<body>
  <div id="wrapper">
    <h1><a href="/">~</a> /</h1>
    <ul id="files">`);

  // loop kai zarye sari files ko show karwa rhe hain

   files.forEach(file => {
          const filePath = path.join(urlPath, file);
          const stat = fs.statSync(filePath);
          const size = stat.size;
          const mtime = stat.mtime.toLocaleString();

          const ext = path.extname(file).toLowerCase();
          let iconClass = '📄'; // default

          if (stat.isDirectory()) iconClass = '📁';
          else if (ext === '.js') iconClass = '🟨';
          else if (ext === '.html') iconClass = '🌐';
          else if (ext === '.css') iconClass = '🎨';
          else if (ext === '.txt') iconClass = '📄';
          else if (ext === '.json') iconClass = '🔢';
          else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif') iconClass = '🖼️';
          else if (ext === '.mp4') iconClass = '🎬';
          else if (ext === '.ico') iconClass = '🔖';
          else if (ext === '.ico') iconClass = '';

          res.write(`
      <li>
        <a href="${req.url === '/' ? '' : req.url}/${encodeURIComponent(file)}" title="${file}">
          <span class="icon">${iconClass}</span>
          <span class="name">${file}</span>
          <span class="size">${size}</span>
          <span class="date">${mtime}</span>
        </a>
      </li>`);
      });

       res.end(`
    </ul>
  </div>
</body>
</html>`);

}

// files serving function
function serveFile(res, urlPath, port) {
  
  const ext = path.extname(urlPath);
    const contentType =
      {
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".ico": "image/x-icon",
        ".jpg": "image/jpg",
        ".jpeg": "image/jpg",
        ".png": "image/png",
        ".pdf": "application/pdf",
      }[ext] || "text/plain";

      res.writeHead(200, { "Content-Type": contentType });
      const readStream = fs.createReadStream(urlPath);

      if (contentType === "text/html") {
        const script = `
          <script>
          // !!code injected by Server!!
            const socket = new WebSocket("ws://localhost:${port}");
            socket.onmessage = (msg) => {
              if (msg.data === "reload") {
                location.reload();
              }
            };
          </script>
        `;

        readStream.on("data", (chunk) => {

        const idx = chunk.toString().toLowerCase().lastIndexOf("</html>");
        if(idx !== -1){
          const before = chunk.slice(0, idx);
          const after = chunk.slice(idx);

          res.write(before + script + after);

        } else {
          res.write(chunk);
        }

        });

        readStream.on('end', () => {
          res.end();
        });
      }
      else {
        readStream.pipe(res);
      }

}
