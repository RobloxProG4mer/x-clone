fetch("https://discord.com/api/v9/users/@me/widgets", {
	headers: {
		accept: "*/*",
		"accept-language": "en-US,en;q=0.9",
		authorization:
			"Nzc5NzUyNTgwMDQ5OTI4MjAz.G6ktBt.I6CX9nKQjCIh5bBsUfqC2rDwtTw6jaofCjTE6Q",
		"cache-control": "no-cache",
		"content-type": "application/json",
		pragma: "no-cache",
		priority: "u=1, i",
		"sec-ch-ua": '"Not_A Brand";v="99", "Chromium";v="142"',
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": '"macOS"',
		"sec-fetch-dest": "empty",
		"sec-fetch-mode": "cors",
		"sec-fetch-site": "same-origin",
		"sec-gpc": "1",
		"x-debug-options": "bugReporterEnabled",
		"x-discord-locale": "en-US",
		"x-discord-timezone": "Europe/Lisbon",
		"x-super-properties":
			"eyJvcyI6Ik1hYyBPUyBYIiwiYnJvd3NlciI6IkNocm9tZSIsImRldmljZSI6IiIsInN5c3RlbV9sb2NhbGUiOiJlbi1VUyIsImhhc19jbGllbnRfbW9kcyI6ZmFsc2UsImJyb3dzZXJfdXNlcl9hZ2VudCI6Ik1vemlsbGEvNS4wIChNYWNpbnRvc2g7IEludGVsIE1hYyBPUyBYIDEwXzE1XzcpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xNDIuMC4wLjAgU2FmYXJpLzUzNy4zNiIsImJyb3dzZXJfdmVyc2lvbiI6IjE0Mi4wLjAuMCIsIm9zX3ZlcnNpb24iOiIxMC4xNS43IiwicmVmZXJyZXIiOiJodHRwczovL2Rpc2NvcmQuY29tLyIsInJlZmVycmluZ19kb21haW4iOiJkaXNjb3JkLmNvbSIsInJlZmVycmVyX2N1cnJlbnQiOiIiLCJyZWZlcnJpbmdfZG9tYWluX2N1cnJlbnQiOiIiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjo0NzEzODMsImNsaWVudF9ldmVudF9zb3VyY2UiOm51bGwsImNsaWVudF9sYXVuY2hfaWQiOiJlMWQ4YzE1OS00NzM3LTQ2OWMtOWNjZS0yZDQ4MTU1Y2IwNDkiLCJsYXVuY2hfc2lnbmF0dXJlIjoiM2E3ODRiY2UtYzVkZi00N2JmLTg4MmMtZTNiNTdlMzI1MzNkIiwiY2xpZW50X2FwcF9zdGF0ZSI6ImZvY3VzZWQiLCJjbGllbnRfaGVhcnRiZWF0X3Nlc3Npb25faWQiOiJkN2M0YjQwOS0xYzg0LTQwODEtOGY1ZC1iNzQ2ZWMzMmRiZDcifQ==",
	},
	referrer:
		"https://discord.com/channels/1416158481488285756/1416158483484508239",
	body: JSON.stringify({
		widgets: [
			{
				data: {
					type: "favorite_games",
					games: [{ game_id: "670067" }],
				},
			},
			{
				data: {
					type: "played_games",
					games: [
						{ game_id: "670067" },
						{ game_id: "670068" },
						{ game_id: "670069" },
						{ game_id: "670070" },
						{ game_id: "670071" },
						{ game_id: "670072" },
						{ game_id: "670073" },
						{ game_id: "670074" },
						{ game_id: "670075" },
						{ game_id: "670076" },
						{ game_id: "670077" },
						{ game_id: "670078" },
						{ game_id: "670079" },
						{ game_id: "670080" },
						{ game_id: "670081" },
						{ game_id: "670082" },
						{ game_id: "670083" },
						{ game_id: "670084" },
						{ game_id: "670085" },
						{ game_id: "670086" },
					],
				},
			},
			{
				data: {
					type: "want_to_play_games",
					games: [
						{ game_id: "670067" },
						{ game_id: "670068" },
						{ game_id: "670069" },
						{ game_id: "670070" },
						{ game_id: "670071" },
						{ game_id: "670072" },
						{ game_id: "670073" },
						{ game_id: "670074" },
						{ game_id: "670075" },
						{ game_id: "670076" },
						{ game_id: "670077" },
						{ game_id: "670078" },
						{ game_id: "670079" },
						{ game_id: "670080" },
						{ game_id: "670081" },
						{ game_id: "670082" },
						{ game_id: "670083" },
						{ game_id: "670084" },
						{ game_id: "670085" },
						{ game_id: "670086" },
					],
				},
			},
			{
				data: {
					type: "current_games",
					games: [
						{
							game_id: "670067",
						},
						{
							game_id: "670068",
						},
						{
							game_id: "670069",
						},
						{
							game_id: "670061",
						},
						{
							game_id: "670062",
						},
					],
				},
			},
		],
	}),
	method: "PUT",
	mode: "cors",
	credentials: "include",
});
