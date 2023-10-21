import java.util.Random;
import java.util.Base64;

public class AnswersToken {
    public static final int TOKEN_LENGTH = 42;
    public static final String CHARSET = "abcdefghijklmnopqrstuvwxyz" + "abcdefghijklmnopqrstuvwxyz".toUpperCase() + "1234567890" + "!@#$%^&*()";

    public static String createToken(long seed) {
        Random random = new Random(seed);
        StringBuilder sb = new StringBuilder();
        byte[] encbytes = new byte[42];

        for (int i = 0; i < 42; i++) {
            sb.append(CHARSET.charAt(random.nextInt(CHARSET.length())));
        }

        byte[] bytes = sb.toString().getBytes();

        for (int i = 0; i < bytes.length; i++) {
            encbytes[i] = (byte)(bytes[i] ^ (byte)1);
        }

        return Base64.getUrlEncoder().withoutPadding().encodeToString(encbytes);
    }

    public static void main(String args[]) {
        if (args.length < 2) {
            System.out.println("2 arguments required: <start> <stop>");
        }

        long start = Long.parseLong(args[0]);
        long stop = Long.parseLong(args[1]);
        String token = "";
        for (long l = start; l < stop; l++) {
            token = createToken(l);
            System.out.println(token);
        }
    }
}
