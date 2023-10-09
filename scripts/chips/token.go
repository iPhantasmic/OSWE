package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/tidwall/gjson"
	"log"
	"os"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 13.2.4.2 - Extra Mile: chips token encryption/decryption

var key = []byte("MySuperSecretKeyForParamsToken12")

func decrypt(token string) {
	data, err := base64.RawStdEncoding.DecodeString(token)
	if err != nil {
		log.Fatalln("Error when decoding base64 token string: ", err)
	}

	dataString := string(data)
	utils.PrintInfo("base64 payload: " + dataString)

	ivBase64 := gjson.Get(dataString, "iv").String()
	utils.PrintInfo("IV: " + ivBase64)

	iv, err := base64.StdEncoding.DecodeString(ivBase64)
	if err != nil {
		log.Fatalln("Error when decoding base64 IV string: ", err)
	}

	value := gjson.Get(dataString, "value").String()
	utils.PrintInfo("Encrypted value: " + value)

	ciphertext, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		log.Fatalln("Error when decoding base64 value string: ", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		log.Fatalln("AES cipher block error: ", err)
	}

	if len(iv) != aes.BlockSize {
		log.Fatalln("IV length must be 16 bytes!")
	}

	cbc := cipher.NewCBCDecrypter(block, iv)
	plaintext := make([]byte, len(ciphertext))

	cbc.CryptBlocks(plaintext, ciphertext)

	plaintext = unpad(plaintext)

	utils.PrintSuccess("Decrypted: " + string(plaintext))
}

func encrypt(clientOptions string) {
	// generate a random IV (Initialization Vector) for CBC mode (16 bytes)
	iv := make([]byte, aes.BlockSize)
	if _, err := rand.Read(iv); err != nil {
		log.Fatalln("Error generating IV:", err)
	}

	plaintext := []byte(clientOptions)

	// apply PKCS7 padding to the plaintext to ensure it's a multiple of the block size
	blockSize := aes.BlockSize
	padLen := blockSize - (len(plaintext) % blockSize)
	padding := bytes.Repeat([]byte{byte(padLen)}, padLen)
	plaintext = append(plaintext, padding...)

	block, err := aes.NewCipher(key)
	if err != nil {
		log.Fatalln("AES cipher block error: ", err)
	}

	ciphertext := make([]byte, len(plaintext))
	mode := cipher.NewCBCEncrypter(block, iv)

	mode.CryptBlocks(ciphertext, plaintext)

	value := base64.StdEncoding.EncodeToString(ciphertext)
	ivBase64 := base64.StdEncoding.EncodeToString(ciphertext)
	utils.PrintInfo("Encrypted value: " + value)
	utils.PrintInfo("IV: " + ivBase64)

	payload, err := json.Marshal(map[string]string{
		"iv":    ivBase64,
		"value": value,
	})
	if err != nil {
		log.Fatalln("Failed to marshal JSON: ", err)
	}

	payloadBase64 := base64.RawStdEncoding.EncodeToString(payload)
	utils.PrintSuccess("Token: " + payloadBase64)
}

// unpad removes PKCS7 padding from the decrypted plaintext
func unpad(data []byte) []byte {
	if len(data) == 0 {
		return data
	}
	padSize := int(data[len(data)-1])
	if padSize < 1 || padSize > aes.BlockSize {
		return data
	}
	return data[:len(data)-padSize]
}

func main() {
	mode := flag.String("mode", "decrypt", "decrypt/encrypt")
	token := flag.String("token", "", "token generated from /token")
	payload := flag.String("payload", "", "new client options to encrypt")

	// parse args
	flag.Parse()
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 3 {
		utils.PrintFailure(fmt.Sprintf("usage: %s --mode=decrypt/encrypt [--token=<token>] [-payload=<client options>]", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s --mode=decrypt --token=", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s --mode=encrypt --payload=", os.Args[0]))
		os.Exit(1)
	}

	if *mode == "decrypt" {
		decrypt(*token)
	} else if *mode == "encrypt" {
		encrypt(*payload)
	} else {
		utils.PrintFailure("Invalid mode!")
		os.Exit(1)
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
