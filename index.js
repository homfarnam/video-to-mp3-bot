const { Telegraf } = require("telegraf");
require("dotenv").config();
const bot = new Telegraf("");
const path = require("path");
const request = require("request");
const fetch = require("node-fetch");
const fs = require("fs");
const PdfExtractor = require("pdf-extractor").PdfExtractor;
const CanvasRenderer = require("pdf-extractor").CanvasRenderer;
const SvgRenderer = require("pdf-extractor").SvgRenderer;
const FileWriter = require("pdf-extractor").FileWriter;

class JPGWriter extends FileWriter {
  getFilePathForPage(page) {
    return super.getPagePath(page.pageNumber, "png");
  }

  writeCanvasPage(page, viewport, canvas) {
    return this.writeStreamToFile(
      canvas.jpgStream(),
      this.getFilePathForPage(page)
    );
  }
}

class JPGCanvasRenderer extends CanvasRenderer {
  getWriters(writerOptions) {
    let writers = super.getWriters(writerOptions);
    writers.push(new JPGWriter(this.outputDir, writerOptions));
    return writers;
  }
}

const pdfExtractor = (url) =>
  new PdfExtractor(url, {
    pdfJs: { disableFontFace: true },
    viewportScale: (width, height) => {
      //dynamic zoom based on rendering a page to a fixed page size
      if (width > height) {
        //landscape: 1100px wide
        return 1100 / width;
      }
      //portrait: 800px wide
      return 800 / width;
    },
    // all the pages
    pageRange: {
      start: 1,
      end: 100,
    },
    JPGCanvasRenderer: JPGCanvasRenderer,
  });

let pageLength = 0;

bot.help((ctx) => ctx.reply("Send me a sticker"));

// this is used to download the file from the link
const download = (url, path, callback) => {
  request.head(url, (err, res, body) => {
    request(url).pipe(fs.createWriteStream(path)).on("close", callback);
  });
};

const sleep = (time) => {
  return new Promise((resolve) => setTimeout(resolve, time));
};

bot.on("text", (ctx, next) => {
  console.log("here");

  ctx.telegram.sendMessage(
    ctx.message.chat.id,
    "User id: " + ctx.message.chat.id
  );
});

// get file content data from telegram
bot.on("document", async (ctx) => {
  console.log("here");

  const fileId = ctx.message.document.file_id;

  const fileName = ctx.message.document.file_name;

  // console.log(ctx.message.document);

  const res = await fetch(
    `https://api.telegram.org/bot5716003495:AAGtU52nwVtNU4iDASSl2qkokyTSIupFivo/getFile?file_id=${fileId}`
  );

  const res2 = await res.json();

  const filePath = res2.result.file_path;
  // console.log('result: ', res2.result);

  const downloadURL = `https://api.telegram.org/file/bot5716003495:AAGtU52nwVtNU4iDASSl2qkokyTSIupFivo/${filePath}`;

  const chatFolderID = `./images/${ctx.message.chat.id}`;

  if (!fs.existsSync(chatFolderID)) {
    console.log("dont exist", ctx.message.chat.id);
    console.log(`./images/${ctx.message.chat.id}`);
    // fs.mkdirSync(`./images/${ctx.message.chat.id}`);
    fs.mkdir(path.join("./images/", `${ctx.message.chat.id}`), (err) => {
      if (err) {
        return console.error("error create folder: ", err);
      }
      console.log("Directory created successfully!");
    });
    console.log(`./images/${ctx.message.chat.id}`);
  }

  await download(downloadURL, path.join(chatFolderID, `${fileName}`), () =>
    console.log("Done!")
  );

  try {
    await pdfExtractor(`./images/${ctx.message.chat.id}`)
      .parse(`./images/${ctx.message.chat.id}/${fileName}`)
      .then((res) => {
        pageLength = res.jsonData.numpages;

        console.log("# End of Document - done");
      })
      .catch(function (err) {
        console.error("Error: " + err);
      });
  } catch (error) {
    console.log(error);
  }

  // console.log({ pageLength });

  // // sendAllPhotos(ctx, chatFolderID);

  // // get all the png images from the folder
  const files = fs
    .readdirSync(chatFolderID)
    .filter((file) => file.endsWith(".png"));

  console.log({ files });
  let fileCount = 1;

  // await Promise.all(
  //   files.map(async (file, index) => {
  //     console.log({ file });
  //     const image = fs.readFileSync(`${chatFolderID}/${file}`);

  //     setTimeout(() => {
  //       ctx.telegram.sendPhoto(ctx.message.chat.id, {
  //         source: image,
  //         filename: `page-${fileCount}.png`,
  //       });
  //     }, 1000);
  //   })
  // );

  // files.forEach(async (file, index) => {
  //   console.log({ file });
  //   const image = fs.readFile(`${chatFolderID}/${file}`, (err, data) => {
  //     if (err) {
  //       console.log('error: ', err);
  //       throw err;
  //     }
  //     return data;
  //   });

  //   console.log({ image });
  //   ctx.telegram.sendPhoto(ctx.message.chat.id, {
  //     source: image,
  //     filename: `page-${fileCount}.png`,
  //   });
  // });

  // deleteFolderRecursive(chatFolderID);

  do {
    console.log("image: ", `${chatFolderID}/page-${fileCount}.png`);

    // open image with fs
    const image = fs.readFileSync(`${chatFolderID}/page-${fileCount}.png`);

    ctx.telegram.sendPhoto(ctx.message.chat.id, {
      source: image,
      filename: `page-${fileCount}.png`,
    });
    fileCount++;
  } while (files.length >= fileCount);
});

// delete all the files from the folder
const deleteFolderRecursive = (path) => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file, index) => {
      const curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

bot.launch();
