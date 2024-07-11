require('dotenv').config()

const tmi = require('tmi.js');
const he = require('he');
const { io } = require('socket.io-client');

const opayId = process.env.OPAY_ID;
const chatbotSendToChannel = process.env.CHATBOT_SEND_TO_CHANNEL;

let donateHistoryId = 0;
let tmiClient;

tmiClient = new tmi.Client({
  // options: { debug: true },
  identity: {
    username: process.env.CHATBOT_USERNAME,
    password: process.env.CHATBOT_OAUTH_TOKEN,
  },
  channels: [ chatbotSendToChannel ],
});

tmiClient.connect().catch(console.error);
tmiClient.on('message', (channel, tags, message, self) => {
  if (self) return;
  if (message.toLowerCase() === '!hello') {
    tmiClient.say(channel, `@${tags.username}, heya!`);
  }
});

const sleep = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const checkDonate = async (payload) => {
  response = payload.data;
  const { lstDonate, settings } = response;
  for (const donate of lstDonate) {
    if (donateHistoryId < donate.donateid) {
      const msgTemplate = he.decode(settings.MsgTemplate);
      let message = msgTemplate.replace('{name}', donate.name).replace('{amount}', donate.amount);
      message += donate.msg !== null ? ` - ${donate.msg}` : '';
      tmiClient.say(chatbotSendToChannel, message);
      donateHistoryId = donate.donateid;
      await sleep(1000);
    }
  };
};

(async () => {
  const namespace = `/web/live/${opayId}`;
  const socket = io('https://socket.opay.tw' + namespace, {
    reconnectionDelayMax: 10000,
  });
  socket.on('connect', () => {
    console.log('on connect - 連線成功');
  });
  socket.on('disconnect', () => {
    console.log('on disconnect - 連線中斷');
  });
  socket.on('connect_error', (error) => {
    console.log('on connect_error - 連線錯誤: ', error);
  });
  socket.on('error', (error) => {
    console.log('on error - 發生錯誤: ', error);
  });
  socket.on('notify', checkDonate);
})();
