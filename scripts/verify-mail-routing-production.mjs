const urls = [
  "https://oriens-academy.com/tr/",
  "https://oriens-academy.com/tr/iletisim/",
  "https://oriens-academy.com/tr/iptal-ve-iade-kosullari/",
];
const legacyPaymentMailbox = ["payments", "oriens-academy.com"].join("@");
const canonicalMailbox = "info@oriens-academy.com";

for (const url of urls) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const html = await response.text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)]
    .map((match) => new URL(match[1], url).href);
  let activeSource = html;
  for (const scriptUrl of scripts) {
    const scriptResponse = await fetch(scriptUrl);
    if (!scriptResponse.ok) throw new Error(`${scriptUrl} returned ${scriptResponse.status}`);
    activeSource += `\n${await scriptResponse.text()}`;
  }
  if (activeSource.includes(legacyPaymentMailbox)) {
    throw new Error(`Retired payment mailbox remains on ${url}`);
  }
  if (!activeSource.includes(canonicalMailbox)) {
    throw new Error(`Canonical mailbox is missing on ${url}`);
  }
  console.log(`PASS ${url} scripts=${scripts.length}`);
}
