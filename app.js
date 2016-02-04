var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var app = express();
var global_base_url = "https://web.spaggiari.eu/home/app/default/";
var base_url = "https://web.spaggiari.eu/cvv/app/default/";


app.get('/', function (req, res) {
	res.send("No arguments provided")
});


app.get('/:custcode/:usercode/:password', function (req, res) {
	var url = global_base_url + "login.php?custcode="+ req.params.custcode +"&login="+ req.params.usercode +"&password="+ req.params.password + "&mode=custcode";
	var jar = request.jar();
	request({url: url, jar: jar}, function(error, response, body) {
		  $ = cheerio.load(body);
		  if ($('.name').length) {
		  	res.send('{"status":"OK", "sessionId":"' + jar.getCookies(url)[0].value + '"}');
		  } else {
		  	res.send('{"status":"error"}');
		  }
	});
});


app.get('/:sessionId/', function (req, res) {
	var url = global_base_url + "menu_webinfoschool_genitori.php";
	request({url: url, /*jar: jar*/ headers: {'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0',
	            'Set-Cookie': "PHPSESSID=" + req.params.sessionId,
	            'Cookie': "PHPSESSID=" + req.params.sessionId}
	}, function(error, response, body) {
		$ = cheerio.load(body);
		if ($('.name').length) {
			var result = new Object();
			result['status'] = "OK";
			result['name'] = $('.name').text();
			result['school'] = $('.scuola').text();
			res.send(JSON.stringify(result));
		} else {
			res.send('{"status":"error"}');
		}
	});
});


app.get('/:sessionId/votes', function (req, res) {
	var url = base_url + "genitori_note.php";
	request({url: url, /*jar: jar*/ headers: {'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0',
	            'Set-Cookie': "PHPSESSID=" + req.params.sessionId,
	            'Cookie': "PHPSESSID=" + req.params.sessionId}
	}, function(error, response, body) {
		$ = cheerio.load(body);
		var votes = new Object();
		var subject =  [];
		$('#data_table_2 tr').not('#placeholder_row').each(function(i, e) {
			if ($(this).children('td').first().text().match(/[a-z]/i)) {
				var entry = $(this).children('td').first().text().replace(/(\n)/gm, "");
				if (entry != subject) {
					  votes[entry] = [];
					  subject = entry;
				}
			} else {
				var entry = $(this).children('td').eq(1).children('div').children('p').text();
				var what = $(this).children('td').eq(1).children('p').text()
				votes[subject].push({vote:entry, type:what});
			}
		});
		res.send(votes);
	});
});


app.get('/:sessionId/agenda', function (req, res) {
	var url = base_url + "agenda_studenti.php?ope=get_events&classe_id=&gruppo_id=&start=" + parseInt(((new Date).getTime() / 1000 - 86400)) + "&end=" + parseInt(((new Date).getTime() / 1000 + 86400 * 7));
	request({url: url, /*jar: jar*/ headers: {'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0',
	            'Set-Cookie': "PHPSESSID=" + req.params.sessionId,
	            'Cookie': "PHPSESSID=" + req.params.sessionId}
	}, function(error, response, body) {
		$ = cheerio.load(body);
		res.send( body );
	});
});


app.get('/:sessionId/files', function (req, res) {
	var url = base_url + "didattica_genitori.php";
	request({url: url, /*jar: jar*/ headers: {'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0',
		'Set-Cookie': "PHPSESSID=" + req.params.sessionId,
		'Cookie': "PHPSESSID=" + req.params.sessionId}
	}, function(error, response, body) {
		$ = cheerio.load(body);

		var files = {};
		var teacher = "";
		$('#data_table tr').slice(9).each(function(i, e) {
			var entry = $(this);
			if (entry.attr('style') == "height: 40px;") {
				teacher = entry.text().slice(21, -7);
				files[teacher] = [];
			}
			if (entry.hasClass('row_parent')) {
				var name = entry.text().slice(5, -4);
				files[teacher].push({"name":name, "list":[]});
			}
			if (entry.hasClass('contenuto')) {
				var name = entry.children('.contenuto_desc').children('div').children('span').eq(0).text()
			  	files[teacher][files[teacher].length-1]['list'].push({"file":name, "id":entry.attr('contenuto_id'), "url":base_url + "didattica_genitori.php?a=downloadContenuto&contenuto_id=" + entry.attr('contenuto_id')});	
			}
		});
		res.send(files);
	});
});

/* ####### TODO ####### */
app.get('/:sessionId/oggi', function (req, res) {
	var url = base_url + "regclasse.php";
	request({url: url, /*jar: jar*/ headers: {'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0',
	            'Set-Cookie': "PHPSESSID=" + req.params.sessionId,
	            'Cookie': "PHPSESSID=" + req.params.sessionId}
	}, function(error, response, body) {
		$ = cheerio.load(body);
		result = new Object();
		last_index = 0;
		
		// ore non firmate
		ore_mancanti = new Array();
		
		$('#data_table tr.rigtab').each(function(index, element) {
			entry = $(this);
							
			if( !entry.attr("id") && ( entry.attr("valign") != "middle" ) ) {
				// righe di ore effettivamente segnate
				var vdocente = entry.children('.registro_firma_dett_docente').children('div').eq(0).text().trim();
				var vora = entry.children('.registro_firma_dett_ora').text();
				var vmateria_nome = entry.children('.registro_firma_dett_materia').children('span').eq(0).text().trim();
				var	vmateria_id = entry.children('.registro_firma_dett_materia').children('span').eq(1).text();
				var vargomento = entry.children('.registro_firma_dett_argomento_lezione').children('.registro_firma_dett_argomento_nota').text().trim();
				
				// ricavo l'ora
				index = vora.substr(0, vora.indexOf('^'));
				index = index.replace("\n", "");
				// ricavo la durata dell'ora
				pos = vora.indexOf("(") + 1;
				duration = vora.slice(pos, -2);
				
				result[index] = [];
				
				var obj = {
					docente: vdocente,
					ore: duration,
					materia: vmateria_nome,
					argomento: vargomento
				}
				
				if(typeof index == "string") {
					result[index].push(obj);
				}
				
				if( (index - last_index) != 1 ) {
					ore_mancanti.push(index-1);	
				}
				
				last_index = index;	
			}
		});
			
		// aggiungo dichiarazione ore mancanti	
		/*for(var i=0; i < ore_mancanti.length; i++) {
			result[ore_mancanti[i]] = [];
			result[ore_mancanti[i]].push({errore:"Ora non firmata"});
		}
		*/
		
		res.send(result);
	});
});


var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Classeviva API listening at http://%s:%s', host, port);
});