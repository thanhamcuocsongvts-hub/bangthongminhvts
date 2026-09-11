async function test() {
  try {
    const formData = new FormData();
    const blob = new Blob(["test content"], { type: 'text/plain' });
    formData.append('file', blob, 'test.txt');
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    console.log(json);
  } catch (e) {
    console.error(e);
  }
}
test();
