require('dotenv').config()

const nodeFetch = require('node-fetch');
const fetchCookie = require('fetch-cookie');
const tmi = require('tmi.js');
const he = require('he');
const { CronJob } = require('cron');

const fetch = fetchCookie(nodeFetch);

const opayId = process.env.OPAY_ID;
const chatbotSendToChannel = process.env.CHATBOT_SEND_TO_CHANNEL;
const alertBoxEndpoint = 'https://payment.opay.tw/Broadcaster/AlertBox/';
const checkDonateEndpoint = 'https://payment.opay.tw/Broadcaster/CheckDonate/';

let donateHistoryId = 0;
let tmiClient;
let opayRequestToken;

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

const fetchOpayInfo = async (opayId) => {
  const response = await fetch(alertBoxEndpoint + opayId, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    },
  });
  const data = await response.text();
  const regex = /var token = '<input name="__RequestVerificationToken".+value="(.+)"/;
  const match = data.match(regex);

  if (!Array.isArray(match)) {
    throw new Error('解析 token 失敗');
  }

  return match[1];
};

const checkDonate = async (opayId) => {
  const response = await fetchDonateInfo(opayId, opayRequestToken);
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

const fetchDonateInfo = async (opayId, token) => {
  const params = new URLSearchParams();
  params.append('__RequestVerificationToken', token);
  const response = await fetch(checkDonateEndpoint + opayId, {
    method: 'post',
    body: params,
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    },
  });
  const data = await response.json();

  return data;
};

(async () => {
  opayRequestToken = await fetchOpayInfo(opayId);
  setInterval(async () => {
    opayRequestToken = await fetchOpayInfo(opayId);
  }, 21600000);
  const job = new CronJob(
    '*/5 * * * * *',
    async () => {
      await checkDonate(opayId);
    },
    null,
    true,
  );
})();
