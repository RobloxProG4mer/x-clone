import { SizeHint, Window } from "bunview";

const window = new Window(true);

window.on("ready", () => {
	window.setTitle("Tweetapus");
	window.navigate("https://tweeta.tiago.zip");
});

setInterval(() => {
  console.log(Math.random());
}, 1000);