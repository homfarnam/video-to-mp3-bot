const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const path = require("path");
const fs = require("fs");
var ffmpeg = require("fluent-ffmpeg");
const { MongoClient } = require("mongodb");
const _ = require("lodash");
const { Button } = require("telegram/tl/custom/button");
require("dotenv").config();
const keys = require("./keys/keys.json");

const uri = process.env.MONGO_URL;

const mongo = new MongoClient(uri);

const database = mongo.db("telegram");
const allData = database.collection("data");

ffmpeg.setFfmpegPath("./ffmpeg");

const apiId = keys.API_ID;

const apiHash = keys.API_HASH;

const stringSession = keys.STRING_SESSION;

const createUser = async (newUser) => {
  await allData.insertOne(newUser);
};

(async () => {
  const client = new TelegramClient(
    new StringSession(stringSession),
    apiId,
    apiHash,
    {
      connectionRetries: 5,
    }
  );
  await client.start();

  const dbData = await allData.find({}).toArray();

  client.addEventHandler(async (update) => {
    console.log("Received new Update");

    const chatID = Number(update.message.chatId);

    if (fs.existsSync(`./videos/${chatID}`)) {
      fs.rmSync(`./videos/${chatID}`, { recursive: true });
    }

    const userData = await client.invoke(
      new Api.users.GetFullUser({
        id: new Api.InputUser({
          userId: update.message.peerId.userId,
        }),
      })
    );

    await client.invoke(
      new Api.bots.SetBotCommands({
        scope: new Api.BotCommandScopeDefault({}),
        langCode: "en",
        commands: [
          new Api.BotCommand({
            command: "start",
            description: "Start the bot",
          }),
          new Api.BotCommand({
            command: "help",
            description:
              "Get information on how to use the bot and its features. You will receive a list of available commands and explanations on how to use them",
          }),
        ],
      })
    );

    /**
     * Help command
     */
    if (update.message.message.startsWith("/help")) {
      const help = await client.sendMessage(chatID, {
        message: `Send a video file to the bot, then the bot will convert the video file to an audio file and send it back to you.`,
      });
    }

    await client.invoke(
      new Api.bots.SetBotMenuButton({
        userId: chatID,
        button: new Api.BotMenuButtonDefault({}),
      })
    );

    /**
     *  start command
     *
     * */

    client.sendMessage(keys.channelUser, {
      message: `User @${userData.users[0].username} is working with the bot`,
    });

    if (update.message.message.startsWith("/start")) {
      const newUser = {
        chatId: Number(chatID),
        subscription: false,
        userName: userData.users[0].username,
      };

      const isUserExist = dbData.find(
        (user) => Number(user.chatId) === Number(chatID)
      );

      if (!isUserExist) {
        client.sendMessage(keys.channelUser, {
          message: `New user joined the bot: @${userData.users[0].username}`,
        });
        createUser(newUser);
      }

      client.sendMessage(2829192, {
        message: `New user joined the bot: ${userData.users[0].username}`,
      });

      // const markup = client.buildReplyMarkup(Button.inline("Hello!"));

      client.sendMessage(chatID, {
        message: `Welcome to the Video to Audio bot!\nIn order to use this bot, you need to send a video file to the bot, then the bot will convert the video file to an audio file and send it back to you.`,
        // buttons: markup,
      });
    }

    if (
      update.message?.media &&
      update.message?.media?.document.mimeType === "video/mp4"
    ) {
      const fileSize = Number(update.message.media.document.size.value);

      const chatFolderID = `./videos/${chatID}`;

      const fileId = update.message.document.id.value;

      if (!fs.existsSync(chatFolderID)) {
        fs.mkdir(path.join("./videos/", `${chatID}`), (err) => {
          if (err) {
            return console.error("error create folder: ", err);
          }
          console.log("Directory created successfully!");
        });
      }

      const downloadMessage = await client.sendMessage(chatID, {
        message: `Downloadeding video file...`,
        replyTo: update.message.id,
      });

      const THROTTLE_RATE = 1000;

      const throttledProgressUpdate = _.throttle(
        async (progress, text, messageId) => {
          client.editMessage(chatID, {
            message: messageId,
            text: `${text} ${Math.round(
              (progress / fileSize) * 100
            )}% of the video file...`,
          });
        },
        THROTTLE_RATE,
        { leading: true, trailing: false }
      );

      const fileName = update.message.media.document.attributes[1].fileName;

      // split filename with mp4 format
      const fileNameSplit = fileName.split(".mp4");

      await client
        .downloadFile(update.message.media, {
          workers: 5,
          progressCallback: async (progress) => {
            throttledProgressUpdate(progress, "Download", downloadMessage.id);
          },
        })
        .then((data) => {
          client.editMessage(chatID, {
            message: downloadMessage.id,
            text: "Video downloaded...",
          });
          fs.writeFileSync(`./videos/${chatID}/${fileNameSplit}.mp4`, data);

          return data;
        })
        .catch((err) => {
          console.log("err: ", err);
          return { error: err };
        });

      const outputFile = `./videos/${chatID}/${fileNameSplit}.mp3`;

      const convertMessage = await client.editMessage(chatID, {
        message: downloadMessage.id,
        text: "Video converting...",
      });

      ffmpeg(`./videos/${chatID}/${fileNameSplit}.mp4`)
        .toFormat("mp3")
        .on("progress", async (progress) => {
          console.log(
            Number(progress.targetSize) * Number(fileSize),
            "progress: ",
            `Convert ${Math.round(
              (Number(progress.targetSize) / Number(fileSize)) * 10000
            )}% of the video file...`
          );
        })
        .on("end", async () => {
          console.log("Video converted..., done");
          client.editMessage(chatID, {
            message: downloadMessage.id,
            text: "Video converted...",
          });

          const files = fs
            .readdirSync(`./videos/${chatID}`)
            .filter((file) => file.endsWith(".mp3"));
          console.log({ files });

          const uploadMessage = await client.editMessage(chatID, {
            message: downloadMessage.id,
            text: "Uploading audio file...",
          });

          for (const file of files) {
            await client.sendFile(chatID, {
              file: `./videos/${chatID}/${file}`,
              replyTo: downloadMessage.id,
            });
          }

          await client.editMessage(chatID, {
            message: downloadMessage.id,
            text: "Your audio file is ready!",
          });

          await fs.rmSync(`./videos/${chatID}`, { recursive: true });
        })
        .on("error", (err) => {
          console.log("error: ", err);
        })
        .pipe(fs.createWriteStream(outputFile), { end: true });
    }
  });
})();
