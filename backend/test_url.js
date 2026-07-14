async function test() {
  try {
    const res = await fetch('https://plant-book.onrender.com/user/');
    const text = await res.text();
    console.log('Total characters:', text.length);
    console.log('Last 100 characters:', JSON.stringify(text.slice(-100)));
    
    let pos = -1;
    while ((pos = text.indexOf('+', pos + 1)) !== -1) {
      console.log("Found '+' at pos " + pos + ": \"" + text.substring(Math.max(0, pos - 15), Math.min(text.length, pos + 15)).replace(/\n/g, '\\n') + "\"");
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
