
import express from "express";
import db from "./db.js";
import {readFile} from "fs/promises";
import path from "path";
import bodyParser from "body-parser";

const app = express();
const quoteServerIp = "10.24.83.87"; // make it ENV

const adminUserName = "admin.super.secret";

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(bodyParser.urlencoded());

app.use("/static", express.static(path.resolve("static")));

app.use((req, res, next)=>{
	if(/^\/login\/?$/.test(req.path)){
		return next();
	}
	const cookies = req.header("cookie") || "";
	const userName = cookies
		.split("; ")
		.filter(x=>x.startsWith("user="))[0]
		?.replace("user=", "");
	if(userName){
		res.locals.user = userName;
		next();
	}else{
		res.redirect("/login");
	}
});

function formatLastSeenTime(lastSeen){
	const timeSinceLastVisit = Date.now() - parseInt(lastSeen);
	const sMsec = 1000;
	const mMsec = sMsec * 60;
	const hMsec = mMsec * 60;
	const h = Math.floor(timeSinceLastVisit/hMsec);
	const m = Math.floor( (timeSinceLastVisit - h * hMsec) / mMsec );
	const s = Math.floor( (timeSinceLastVisit - h * hMsec - m * mMsec) / sMsec );
	return `${h}H:${m}M:${s}S`;
}

app.use(async (req, res, next)=>{
	if(res.locals.user){
		if(!db.isValidUserName(res.locals.user)){
			return res.status(400).send("Bad user name supplied");
		}
		const aUser = await db.findUser(res.locals.user);
		if(!aUser){
			if(req.accepts("json")){
				res.status(404).send({msg: `User by the name ${res.locals.user} does not exist.`});
			}else if(req.accepts("html")){
				res.redirect("/login");
			}else{
				res.status(406).send("Requested resource type is Not acceptable");
			}
			return;
		}
		res.locals.lastSeen = formatLastSeenTime(aUser.lastSeen);
		await db.updateUser({name: aUser.name, lastSeen: Date.now()});
	}
	next();
});

app.use("/admin", (req, res, next)=>{
	if(res.locals.user === adminUserName){
		next();
	}else{
		res.status(403).send("You can't access admin pages.");
	}
});

app.get(["/admin/logs", "/admin/logs/:lastNLines"], async (req, res)=>{
	const allLogs = await readFile(path.resolve("logs.txt"), "utf8");
	const allLogsAsLines = allLogs.split("\n");
	req.params.lastNLines ??= allLogsAsLines.length;
	req.params.lastNLines = parseInt(req.params.lastNLines, 10);
	var errMsg = "";
	if(Number.isNaN(req.params.lastNLines)){
		errMsg	= "The number of requested lines is not a number \n\n";
	}
	const str2send = allLogsAsLines.slice(allLogsAsLines.length - req.params.lastNLines, allLogsAsLines.length).join("\n");
	res.status(200).type("text/plain").send(errMsg + str2send);
});

app.get("/", async (req, res)=>{
	try {
		const quoteResp = await fetch("http://" + quoteServerIp + ":8081", { signal: AbortSignal.timeout(6000) });	
		if(!quoteResp.ok){
			res.locals.quote = "Couldn't get a quote to show :(";
		}else{
			res.locals.quote = await quoteResp.text();
		}
	} catch (error) {
		res.locals.quote = "Couldn't get a quote to show :(";
	}
	res.render("home");
});

app.get("/login", (req, res)=>{
	res.clearCookie("user");
	res.render("login");
});

app.get("/fall", (req, res)=>{
	// throw new Error("Deliberately making the app fail");
	process.exit(1);
});

app.post("/login", async (req, res)=>{
	console.log(req.body);
	if(!db.isValidUserName(req.body.user)){
		return res.status(400).send("Bad user name supplied");
	}
	const aUserObj = await db.findUser(req.body.user);
	if(req.body.newUser){
		if(aUserObj){
			return res.status(409).send("username already taken");
		}else{
			await db.createUser(req.body.user);
		}
	}else{
		if(!aUserObj){
			return res.status(404).send("username not found");
		}
	}
	res.cookie("user", req.body.user, {maxAge: 1000 * 60 * 60, httpOnly: true});
	res.redirect("/");
});

app.use((err, req, res, next)=>{
	if(process.env.NODE_ENV === "production"){
		return res.status(500).send("some error happened");
	}
	next(err);
});

const appRunningPromise = new Promise((resolve)=>{
	const runningInstance = app.listen(process.env.PORT, ()=>{
		console.log("server is running");
		resolve(runningInstance);
	});
});

export default appRunningPromise;