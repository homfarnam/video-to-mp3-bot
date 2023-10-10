const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const { Button } = require("telegram/tl/custom/button");
require("dotenv").config();

const keys = require("./keys/keys.json");

const apiId = keys.API_ID;

const apiHash = keys.API_HASH;

const stringSession =
  "1BAAOMTQ5LjE1NC4xNjcuOTEAUI8eq+NnTKvtBpmMQSyEMWTp409meYI8U7WA3W51xb+dqD3dpTEkTXOewe8Mg8uJfGhcR8sAvRSawyUcebiRYcm6Bbs7fpiD/2l59SXd3hLlD9tToEcVzMzabAh1zWaHvxpbJe1x+Pde0aCKo8rVujio9PDXWuRXBpFMkFAHS3Mw+tuSD2ABeuL/mSdd+b4H11E02KtoNkMzHNxhwsoZl1VoZNGM5cv/KcUKOyFV24lrjaMbGdaj90uw/BXSCNIcYE++St0mN/CLtD9qSCbg0EPBQrbi1kI7EFiDZr79LriIozj+4Wezpjeb5CiHY6jKRnwhg4ZS5YZyv3GcMCR+INc="; // leave this empty for now

(async () => {
  const client = new TelegramClient(
    new StringSession(stringSession),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );
  await client.start();

  client.addEventHandler(async (update) => {
    const chatID = Number(update.message.chatId);

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
            description: "Medium to PDF",
          }),
        ],
      })
    );

    if (update.message.message.startsWith("/start")) {
      // ...

      // Create the Subscribe button
      const markup = client.buildReplyMarkup(
        Button.text("Subscribe", "subscribe_callback")
      );

      client.sendMessage(chatID, {
        message: `Welcome to the Video to Audio bot!\nIn order to use this bot, you need to send a video file to the bot, then the bot will convert the video file to an audio file and send it back to you.`,
        buttons: markup,
      });
    }

    client.sendMessage(chatID, {
      message: JSON.stringify(update),
    });

    const userData = await client.invoke(
      new Api.users.GetFullUser({
        id: new Api.InputUser({
          userId: update.message.peerId.userId,
        }),
      })
    );
  });
})();
