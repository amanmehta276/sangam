// app/(auth)/signup.tsx
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { AuthAPI } from "../../constants/api";
import { useAuth } from "../../hooks/useAuth";
import { colors, radius, spacing } from "../../constants/theme";

export default function SignupScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    if (!roll.trim() || !name.trim() || !mobile.trim()) {
      Alert.alert("Missing info", "Fill in your roll number, name, and mobile number.");
      return;
    }
    setBusy(true);
    try {
      const res: any = await AuthAPI.signup(roll.trim().toUpperCase(), name.trim(), mobile.trim());
      if (res?.dev_otp) Alert.alert("Dev OTP", `Your OTP is: ${res.dev_otp}`);
      setStep(2);
    } catch (e: any) {
      Alert.alert("Signup failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyAndLogin = async () => {
    if (!otp.trim()) { Alert.alert("Enter OTP", "Please enter the OTP you received."); return; }
    setBusy(true);
    try {
      const res: any = await AuthAPI.verifySignup(roll.trim().toUpperCase(), otp.trim(), name.trim(), mobile.trim());
      await login(res.token, res.user);
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Verification failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Image source={require("../../assets/images/logo-mark.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Join Sangam</Text>
        <Text style={styles.subtitle}>Only students in the college roll-number list can sign up</Text>

        {step === 1 ? (
          <>
            <TextInput style={styles.input} placeholder="Roll Number" placeholderTextColor={colors.text3}
              autoCapitalize="characters" value={roll} onChangeText={setRoll} />
            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={colors.text3}
              value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Mobile Number" placeholderTextColor={colors.text3}
              keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
            <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} disabled={busy} onPress={requestOtp}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput style={styles.input} placeholder="Enter OTP" placeholderTextColor={colors.text3}
              keyboardType="number-pad" value={otp} onChangeText={setOtp} />
            <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} disabled={busy} onPress={verifyAndLogin}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify & Create Account</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: spacing.md }}>
              <Text style={styles.linkText}>← Go back</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" style={styles.linkText}>Log in</Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%", maxWidth: 400, backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: "stretch",
    shadowColor: "#1E293B", shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  logo: { width: 64, height: 64, alignSelf: "center", marginBottom: spacing.sm },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, textAlign: "center" },
  subtitle: { fontSize: 12.5, color: colors.text3, textAlign: "center", marginTop: 6, marginBottom: spacing.xl, paddingHorizontal: 10 },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 14, color: colors.text, marginBottom: spacing.md,
  },
  btn: { backgroundColor: colors.purple, borderRadius: radius.md, paddingVertical: 13, alignItems: "center", marginTop: spacing.xs },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14.5 },
  linkText: { color: colors.purple, fontWeight: "600", fontSize: 13 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { color: colors.text3, fontSize: 13 },
});
