const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));

async function fetchData(d, s) {
  const url = "https://location.hiroden.co.jp/sp/search.cgi";
  const body = `d=${d}&b=${s}.html`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://location.hiroden.co.jp/sp/search.cgi",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      },
      body: body,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    return html;

  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

function parseHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const trainData = [];
  const table = document.getElementById('kekka-table');

  if (table) {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const lineNum = row.querySelector('.lineNum')?.textContent.trim();
      const tdContent = row.querySelector('td')?.textContent.trim();
      const destination = tdContent.replace(lineNum, '').replace(/\s*行き.*/, '行き').trim();
      const time = row.querySelector('.time')?.textContent.trim();
      
      if (lineNum && destination && time) {
        trainData.push({
          line: lineNum,
          destination: destination,
          time: time,
        });
      }
    });
  }
  return trainData;
}

async function fetchAllData() {
  let allData = [];
  for (const d of data) {
    let res = [];
    for (const i of d[2]) {
      const html = await fetchData(i[0], d[0]);
      if (html) {
        const parsed = parseHtml(html);
        res.push({ id: i[0], name: i[1], data: parsed });
      }
    }
    allData.push({ id: d[0], name: d[1], values: res });
  }
  return allData;
}

async function main() {
  const allData = await fetchAllData();
  if (!allData) {
    console.log("No data fetched. Exiting.");
    return;
  }
  
  // 日本時間を取得するための設定
  const now = new Date();
  const options = { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const jstFormatter = new Intl.DateTimeFormat('ja-JP', options);
  const parts = jstFormatter.formatToParts(now);
  
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const second = parts.find(p => p.type === 'second').value;

  const dateString = `${year}-${month}-${day}`;
  const timeString = `${hour}-${minute}-${second}`;

  const dirPath = path.join(__dirname, 'data', dateString);
  const filePath = path.join(dirPath, `${timeString}.json`);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
  console.log(`Data saved to ${filePath}`);
}

main();