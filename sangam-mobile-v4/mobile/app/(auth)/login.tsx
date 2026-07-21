// app/(auth)/login.tsx
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { Link } from "expo-router";
import { AuthAPI } from "../../constants/api";
import { useAuth } from "../../hooks/useAuth";
import { colors, radius, spacing } from "../../constants/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const startCooldown = (seconds: number) => {
    setResendIn(seconds);
    const timer = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) { clearInterval(timer); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const requestOtp = async () => {
    if (!roll.trim() || !name.trim()) {
      Alert.alert("Missing info", "Enter your roll number and name.");
      return;
    }
    setBusy(true);
    try {
      const res: any = await AuthAPI.checkRoll(roll.trim().toUpperCase(), name.trim());
      if (res?.dev_otp) Alert.alert("Dev OTP", `Your OTP is: ${res.dev_otp}`);
      setStep(2);
    } catch (e: any) {
      const match = e.message?.match(/(\d+)s/);
      if (match) startCooldown(parseInt(match[1]));
      Alert.alert("Couldn't send OTP", e.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyAndLogin = async () => {
    if (!otp.trim()) { Alert.alert("Enter OTP", "Please enter the OTP you received."); return; }
    setBusy(true);
    try {
      const res: any = await AuthAPI.login(roll.trim().toUpperCase(), otp.trim());
      Alert.alert("DEBUG - Backend response", JSON.stringify(res));   // ← TEMP LINE
      await login(res.token, res.user);
    } catch (e: any) {
      Alert.alert("Login failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Image source={require("../../assets/images/logo-mark.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Sangam</Text>
        <Text style={styles.subtitle}>Engineering Alumni & Student Network</Text>

        {step === 1 ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Roll Number"
              placeholderTextColor={colors.text3}
              autoCapitalize="characters"
              value={roll}
              onChangeText={setRoll}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.text3}
              value={name}
              onChangeText={setName}
            />
            <TouchableOpacity
              style={[styles.btn, (busy || resendIn > 0) && styles.btnDisabled]}
              disabled={busy || resendIn > 0}
              onPress={requestOtp}
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.btnText}>{resendIn > 0 ? `Resend in ${resendIn}s` : "Send OTP"}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter OTP"
              placeholderTextColor={colors.text3}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
            />
            <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} disabled={busy} onPress={verifyAndLogin}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify & Login</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: spacing.md }}>
              <Text style={styles.linkText}>← Change roll number</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New here? </Text>
          <Link href="/(auth)/signup" style={styles.linkText}>Create an account</Link>
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
  logo: { width: 72, height: 72, alignSelf: "center", marginBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, textAlign: "center", letterSpacing: 2 },
  subtitle: { fontSize: 12, color: colors.text3, textAlign: "center", marginTop: 4, marginBottom: spacing.xl, letterSpacing: 1 },
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
