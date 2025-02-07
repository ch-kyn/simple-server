
import appRunningPromise from "./server.js";

Promise.race([appRunningPromise, new Promise((resolve, reject)=>{
	setTimeout(()=>{
		reject("Server hasn't started in 3 seconds - presuming it won't");
	}, 3000);
})]).then((app)=>{
	app.close();
	console.log("Tests ok");
	process.exit(0);
}).catch((e)=>{
	console.log("Tests failed", e);
	process.exit(1);
});
