import { Api, TelegramClient } from "telegram";
import { NewMessageEvent } from "telegram/events";
import { StringSession } from "telegram/sessions";
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

const adminChatId = keys.admin;

const createUser = async (newUser) => {
  await allData.insertOne(newUser);
};

const updateUser = async (chatId, newValues) => {
  await allData.updateOne(
    {
      chatId: Number(chatId),
    },
    {
      $set: newValues,
    }
  );
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
  await client.start({
    botAuthToken: keys.BOT_TOKEN,
  });

  // create function for get all data from database

  const dbData = await allData.find({}).toArray();

  client.addEventHandler(async (update: NewMessageEvent) => {
    const chatID = Number(update.message.chatId);

    console.log("data: ", await allData.countDocuments());

    if (fs.existsSync(`./videos/${chatID}`)) {
      fs.rmSync(`./videos/${chatID}`, { recursive: true });
    }

    const userData = await client.invoke(
      new Api.users.GetFullUser({
        id: new Api.InputUser({
          userId: update.message.peerId.userId,
          accessHash: update.message.peerId.accessHash,
        }),
      })
    );

    await client.invoke(
      new Api.bots.SetBotCommands({
        scope: new Api.BotCommandScopeDefault(),
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

    // set commands just for admin
    await client.invoke(
      new Api.bots.SetBotCommands({
        scope: new Api.BotCommandScopeChats(adminChatId),
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
          new Api.BotCommand({
            command: "stats",
            description: "Get bot stats",
          }),
          new Api.BotCommand({
            command: "sendmessage",
            description: "Send message to all users command",
          }),
        ],
      })
    );

    if (
      update.message.message.startsWith("/sendmessage") &&
      update.message.peerId.userId === adminId
    ) {
      const message = update.message.message.split(" ").slice(1).join(" ");
      dbData.forEach((user) => {
        client.sendMessage(user.chatId, {
          message: message,
        });
      });
    }

    /**
     * Help command
     */
    if (update.message.message.startsWith("/help")) {
      const help = await client.sendMessage(chatID, {
        message: `Send a video file to the bot, then the bot will convert the video file to an audio file and send it back to you.`,
      });
    }

    const markup2 = client.buildReplyMarkup(Button.inline("Hello!"));

    client.sendMessage(keys.channelUser, {
      message: `User @${userData.users[0].username} is working with the bot`,
      buttons: markup2,
    });

    if (update.message.message.startsWith("/start")) {
      const newUser = {
        chatId: Number(chatID),
        subscription: false,
        userName: userData.users[0].username,
        createdAt: new Date(),
        subscription: [],
        botUsage: 0,
      };

      const isUserExist = dbData.find(
        (user) => Number(user.chatId) === Number(chatID)
      );

      if (!isUserExist) {
        client.sendMessage(keys.channelUser, {
          message: `New user joined the bot: @${userData.users[0].username}`,
        });
        createUser(newUser);

        client.sendMessage(keys.channelUser, {
          message: `All users: ${dbData.length}`,
        });

        client.sendMessage(2829192, {
          message: `New user joined the bot: ${userData.users[0].username}`,
        });
      }

      console.log("user data: ", userData.users[0]);

      if (isUserExist) {
        const options = { upsert: true };

        const newData = {
          firstname: userData.users[0].firstName,
          lastName: userData.users[0].lastName,
        };

        updateUser(chatID, newData, options);
        console.log("update user ...done");
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

      const convertSize = fileSize / 1000000;

      if (convertSize > 100) {
        return await client.sendMessage(chatID, {
          message: `File size is too large, please send a video file with a size of less than 100mb`,
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

      const fileName =
        update.message.media.document.attributes[1]?.fileName || "output";

      // convert byte to mb

      // split filename with mp4 format
      const fileNameSplit = fileName.split(".mp4");

      await client
        .downloadMedia(update.message.media, {
          progressCallback: async (progress) => {
            throttledProgressUpdate(progress, "Download", downloadMessage.id);
          },
          workers: 1,
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
              caption: "\n@vidToAud_bot",
            });
          }

          await client.editMessage(chatID, {
            message: downloadMessage.id,
            text: "Your audio file is ready!",
          });

          // add plus one to bot usage
          const isUserExist = dbData.find(
            (user) => Number(user.chatId) === Number(chatID)
          );

          if (isUserExist) {
            const options = { upsert: true };

            const newData = {
              botUsage: isUserExist.botUsage + 1,
            };

            updateUser(chatID, newData, options);
            console.log("update user ...done");
          }

          await fs.rmSync(`./videos/${chatID}`, { recursive: true });
        })
        .on("error", (err) => {
          console.log("error: ", err);
        })
        .pipe(fs.createWriteStream(outputFile), { end: true });
    }
  });
})();
