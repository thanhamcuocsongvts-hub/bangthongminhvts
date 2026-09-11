async function test() {
  const url = "https://tmpfiles.org/dl/wew4mKNfzFCx/test.txt";
  const msUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
  const res = await fetch(msUrl);
  console.log(res.status);
}
test();
