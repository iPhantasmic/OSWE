date +%s%3N && curl -s -i -X 'POST' --data-binary 'id=guest' 'http://192.168.218.126:8080/opencrx-core-CRX/RequestPasswordReset.jsp' && date +%s%3N
