import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useFonts } from "expo-font";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { DemoProvider, useDemo } from "./src/state/DemoStore";
import {
  registerUser, loginUser, logoutUser, resetPassword,
  observeAuth, getUserProfile, resendVerificationWithCredentials,
  saveHealthProfile, changeDisplayName,
} from "./src/services/authService";
import type { User } from "firebase/auth";
import { addMeal, deleteMeal, subscribeMeals, localDateKey, mealTotals, type MealEntry, type MealType } from "./src/services/nutritionService";
import { vietnamDateLabel, vietnamKeyLabel, shiftVietnamDateKey } from "./src/services/vietnamDate";
import { addWater, deleteWater, subscribeWater, totalWater, type WaterEntry } from "./src/services/waterService";
import { calculateHealth, parseBirthday, formatBirthday, type BiologicalSex } from "./src/services/healthCalculations";
import { NativeScene, SceneActions } from "./src/components/NativeScene";
import { ScreenDirectory } from "./src/components/ScreenDirectory";
import { SplashMotion } from "./src/components/SplashMotion";
import type { DesignNode, DesignScreen } from "./src/design/types";
import { initialChoice } from "./src/design/sceneState";
import { ThemeProvider, useTheme } from "./src/design/theme";
import screenData from "./src/design/screens.json";
import overlayData from "./src/design/overlays.json";
import navigationData from "./src/design/navigation.json";

const screens = screenData as DesignScreen[];
const overlays = overlayData as DesignScreen[];
const nav = navigationData as Record<string, string[]>;
const byId = new Map(screens.map((s) => [s.id, s]));
const overlayById = new Map(overlays.map((s) => [s.id, s]));
const titleFont = "Manrope_800ExtraBold",
  bodyFont = "Manrope_500Medium";

function visit(node: DesignNode, fn: (n: DesignNode) => void) {
  fn(node);
  for (const c of node.children) if (typeof c !== "string") visit(c, fn);
}
function content(node: DesignNode): string {
  return node.children
    .map((c) => (typeof c === "string" ? c : content(c)))
    .join(" ");
}
function textNodes(node: DesignNode) {
  const out: DesignNode[] = [];
  visit(node, (n) => {
    if (n.tag === "p") out.push(n);
  });
  return out;
}
function readInitialScreen() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const n = Number(new URLSearchParams(window.location.search).get("screen"));
    if (Number.isInteger(n) && n >= 1 && n <= screens.length) return n;
  }
  return 6;
}
function withUnit(value: string, unit: string) {
  return value.trim().endsWith(unit) ? value.trim() : value.trim() + " " + unit;
}
function measurement(value: string) {
  return Number.parseFloat(value.replace(",", "."));
}
const fonts = {
  Manrope_400Regular: require("./assets/fonts/Manrope_400Regular.ttf"),
  Manrope_500Medium: require("./assets/fonts/Manrope_500Medium.ttf"),
  Manrope_600SemiBold: require("./assets/fonts/Manrope_600SemiBold.ttf"),
  Manrope_700Bold: require("./assets/fonts/Manrope_700Bold.ttf"),
  Manrope_800ExtraBold: require("./assets/fonts/Manrope_800ExtraBold.ttf"),
  Inter_400Regular: require("./assets/fonts/Inter_400Regular.ttf"),
};

function Frontend() {
  const { data, patch, setField, setChoice, reset, loaded } = useDemo();
  const { isDark, colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts(fonts);
  const [history, setHistory] = useState([readInitialScreen()]);
  const current = history[history.length - 1],
    screen = screens[current - 1];
  const [overlay, setOverlay] = useState<string | null>(null);
  const [directory, setDirectory] = useState(false);
  const [toast, setToast] = useState("");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [verified, setVerified] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [dateKey, setDateKey] = useState(localDateKey());
  const [meals, setMeals] = useState<MealEntry[]>([]);
  // Meal chosen from the Firestore-backed daily journal, not the Figma sample.
  const [selectedMeal, setSelectedMeal] = useState<MealEntry | null>(null);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [journalLoaded, setJournalLoaded] = useState(false);
  const [journalBusy, setJournalBusy] = useState(false);
  const [mealEditor, setMealEditor] = useState(false);
  const [waterEditor, setWaterEditor] = useState(false);
  const [journalListOpen, setJournalListOpen] = useState<"meal"|"water"|null>(null);
  // A separate calendar selection: today's Home totals never change while browsing history.
  const [historyDateKey, setHistoryDateKey] = useState(localDateKey());
  const [historyMeals, setHistoryMeals] = useState<MealEntry[]>([]);
  const [historyWater, setHistoryWater] = useState<WaterEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [journalError, setJournalError] = useState("");
  const [waterAmount, setWaterAmount] = useState("250");
  const [mealDraft, setMealDraft] = useState({
    name: "", mealType: "breakfast" as MealType, calories: "", proteinGrams: "", carbsGrams: "", fatGrams: "",
  });
  const totals = useMemo(() => mealTotals(meals), [meals]);
  const drankMl = useMemo(() => totalWater(waterEntries), [waterEntries]);
  const waterGoalMl = 2000;
  const [editor, setEditor] = useState<{
    label: string;
    key: string;
    value: string;
  } | null>(null);
  const [timer, setTimer] = useState(30),
    [timerPaused, setTimerPaused] = useState(false);
  const [challengeDays, setChallengeDays] = useState(0);
  const scrollPositions = useRef<Record<string, number>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);
  useEffect(() => {
    return observeAuth((user) => {
      setAuthUser(user);
      setVerified(Boolean(user?.emailVerified));
      const fallback = user?.email?.split("@")[0] || "Bạn";
      setDisplayName(fallback);
      if (user?.emailVerified) {
        void getUserProfile(user.uid).then((profile) => {
          if (profile) {
            setDisplayName(profile.name?.trim() || fallback);
            const saved: Record<string,string> = {};
            if (profile.sex) saved.sex = profile.sex;
            if (profile.birthDate) saved.birthDate = profile.birthDate;
            if (profile.heightCm != null) saved.height = String(profile.heightCm);
            if (profile.weightKg != null) saved.weight = String(profile.weightKg);
            if (profile.bodyFatMeasuredPercent != null) saved.bodyFat = String(profile.bodyFatMeasuredPercent);
            if (profile.activityFactor != null) saved.activityFactor = String(profile.activityFactor);
            for (const [key,val] of Object.entries(saved)) setField(key,val);
            patch({setupComplete: Boolean(profile.setupComplete)});
          }
        }).catch(() => {});
      }
    });
  }, []);

  // Keep both journals per authenticated user, never from global demo storage.
  useEffect(() => {
    const refresh = () => { const today = localDateKey(); setDateKey(old => old === today ? old : today); };
    const sub = AppState.addEventListener("change", status => { if (status === "active") refresh(); });
    const interval = setInterval(refresh, 60 * 1000);
    return () => { sub.remove(); clearInterval(interval); };
  }, []);
  useEffect(() => {
    setMeals([]); setWaterEntries([]); setJournalLoaded(false);
    if (!authUser?.emailVerified) return;
    let active = true;
    let loadedMeals = false, loadedWater = false;
    const complete = () => { if (active && loadedMeals && loadedWater) setJournalLoaded(true); };
    const error = (err: Error) => {
      if (!active) return;
      const code = (err as Error & { code?: string }).code || "unknown";
      console.error("[EcoFit] Không tải được nhật ký Firestore:", code, err.message);
      if (code === "permission-denied") {
        showToast("Không thể truy cập nhật ký. Vui lòng kiểm tra quyền Firebase.");
      } else if (code === "unavailable" || code === "deadline-exceeded") {
        showToast("Chưa kết nối được. Vui lòng kiểm tra mạng và thử lại.");
      } else {
        showToast("Không tải được nhật ký. Vui lòng thử lại.");
      }
    };
    let stopMeals = () => {}, stopWater = () => {};
    try {
      stopMeals = subscribeMeals(authUser.uid, dateKey, rows => {
        if (active) { setMeals(rows); loadedMeals = true; complete(); }
      }, error);
      stopWater = subscribeWater(authUser.uid, dateKey, rows => {
        if (active) { setWaterEntries(rows); loadedWater = true; complete(); }
      }, error);
    } catch (_err) { /* a previous unverified session must never expose another user's data */ }
    return () => { active = false; stopMeals(); stopWater(); };
  }, [authUser?.uid, authUser?.emailVerified, dateKey, showToast]);

  // Read only the selected calendar day inside the history dialog.
  // Unsubscribe whenever the dialog closes, the day changes, or the account changes.
  useEffect(() => {
    setHistoryMeals([]);
    setHistoryWater([]);
    setHistoryLoaded(false);
    setHistoryError("");
    if (!journalListOpen || !authUser?.emailVerified) return;
    let active = true;
    const handleError = (err: Error) => {
      if (!active) return;
      const code = (err as Error & {code?: string}).code;
      console.error("[EcoFit] Lỗi đọc lịch sử:", code || "unknown", err.message);
      setHistoryError(code === "permission-denied"
        ? "Bạn chưa có quyền xem nhật ký. Hãy kiểm tra Firestore Rules."
        : "Không tải được nhật ký ngày này. Vui lòng thử lại.");
      setHistoryLoaded(true);
    };
    try {
      const unsubscribe = journalListOpen === "meal"
        ? subscribeMeals(authUser.uid, historyDateKey, entries => {
            if (active) {setHistoryMeals(entries);setHistoryLoaded(true);}
          }, handleError)
        : subscribeWater(authUser.uid, historyDateKey, entries => {
            if (active) {setHistoryWater(entries);setHistoryLoaded(true);}
          }, handleError);
      return () => {active = false;unsubscribe();};
    } catch (error) {
      handleError(error instanceof Error ? error : new Error("Không tải được lịch sử"));
      return () => {active = false;};
    }
  }, [journalListOpen, historyDateKey, authUser?.uid, authUser?.emailVerified]);
  const openJournalHistory = (kind: "meal"|"water") => {
    setHistoryDateKey(localDateKey());
    setJournalListOpen(kind);
  };
  const historyDayMealsTotal = useMemo(() => mealTotals(historyMeals), [historyMeals]);
  const historyDayWaterTotal = useMemo(() => totalWater(historyWater), [historyWater]);
  const historyIsToday = historyDateKey === dateKey;
  const historyQuickDays = useMemo(() =>
    Array.from({length:7}, (_,idx) => shiftVietnamDateKey(dateKey, idx-6)), [dateKey]);

  const recordMeal = async (quick = false) => {
    if (journalBusy) return;
    setJournalError("");
    if (!authUser?.emailVerified) { showToast("Hãy đăng nhập và xác minh email trước."); return; }
    const draft = quick
      ? {name:"Cơm gà rau củ",mealType:"lunch" as MealType,calories:"480",proteinGrams:"38",carbsGrams:"57",fatGrams:"10"}
      : mealDraft;
    const number = (s: string) => Number(s.replace(",", "."));
    if (!draft.name.trim() || [draft.calories,draft.proteinGrams,draft.carbsGrams,draft.fatGrams].some(s => !s.trim() || !Number.isFinite(number(s)))) {
      setJournalError("Hãy nhập tên món và đầy đủ các chỉ số dinh dưỡng."); return;
    }
    setJournalBusy(true);
    try {
      await addMeal({name:draft.name,mealType:draft.mealType,calories:number(draft.calories),proteinGrams:number(draft.proteinGrams),carbsGrams:number(draft.carbsGrams),fatGrams:number(draft.fatGrams)});
      setMealEditor(false);
      setMealDraft({name:"",mealType:"breakfast",calories:"",proteinGrams:"",carbsGrams:"",fatGrams:""});
      showToast("Đã thêm bữa ăn vào nhật ký!");
      if (quick) go(21);
    } catch (_err) { setJournalError("Không lưu được bữa ăn. Kiểm tra thông tin và thử lại."); }
    finally { setJournalBusy(false); }
  };
  const recordWater = async (ml: number) => {
    if (journalBusy) return;
    setJournalError("");
    if (!authUser?.emailVerified) { showToast("Hãy đăng nhập và xác minh email trước."); return; }
    setJournalBusy(true);
    try { await addWater(ml); setWaterEditor(false); showToast(`Đã ghi ${ml} ml nước!`); }
    catch (_err) { setJournalError("Không lưu được lượng nước. Vui lòng thử lại."); }
    finally { setJournalBusy(false); }
  };
  const firebaseErrorMessage = (error: unknown) => {
    const code = (error as { code?: string })?.code;
    if (code === "auth/email-already-in-use") return "Email này đã có tài khoản.";
    if (code === "auth/email-not-verified") return "Email chưa được xác minh. Hãy kiểm tra hộp thư trước khi đăng nhập.";
    if (code === "auth/too-many-requests") return "Gửi quá nhiều yêu cầu, hãy thử lại sau.";
    if (code === "auth/invalid-email") return "Email không hợp lệ.";
    if (code === "auth/weak-password") return "Mật khẩu chưa đủ mạnh.";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password")
      return "Email hoặc mật khẩu không đúng.";

    if (code === "auth/network-request-failed") return "Không kết nối được Firebase. Kiểm tra mạng.";
    if (code === "permission-denied") return "Firestore từ chối truy cập. Kiểm tra Rules.";
    return error instanceof Error ? error.message : "Có lỗi, vui lòng thử lại.";
  };
  const doLogin = async () => {
    if (authBusy) return;
    const email = (data.fields.email || "").trim();
    const password = data.fields.password || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      showToast("Nhập email hợp lệ và mật khẩu.");
      return;
    }
    setAuthBusy(true);
    try {
      const user = await loginUser(email, password);
      setField("password", "");
      setVerificationOpen(false);
      setVerified(true);
      const profile = await getUserProfile(user.uid);
      go(profile?.setupComplete ? 1 : 13);
    } catch (error) {
      if ((error as { code?: string })?.code === "auth/email-not-verified") {
        setVerificationOpen(true);
      }
      showToast(firebaseErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };
  const doRegister = async () => {
    if (authBusy) return;
    const email = (data.fields.email || "").trim();
    const password = data.fields.password || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      showToast("Nhập email hợp lệ và mật khẩu ít nhất 6 ký tự.");
      return;
    }
    // Figma registration screen has no name input: use email prefix for now.
    const name = email.split("@")[0];
    setAuthBusy(true);
    try {
      await registerUser(email, password, name);
      setVerificationOpen(true);
      setHistory([9]); // Verification required before the first login.
      setOverlay(null);
      showToast("Đã gửi liên kết xác minh đến email. Hãy kiểm tra cả thư Spam.");
    } catch (error) {
      showToast(firebaseErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };
  const doResetPassword = async () => {
    if (authBusy) return;
    const email = (data.fields.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Nhập email tài khoản hợp lệ.");
      return;
    }
    setAuthBusy(true);
    try {
      await resetPassword(email);
      showToast("Nếu email đã đăng ký, hãy kiểm tra thư để đặt lại mật khẩu.");
      go(9);
    } catch (error) {
      showToast(firebaseErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };
  const doLogout = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await logoutUser();
      setVerified(false);
      setVerificationOpen(false);
      setDisplayName("");
      setMealEditor(false); setWaterEditor(false); setMeals([]); setWaterEntries([]);
      await reset(); // Avoid sharing demo data between successive users.
      setHistory([9]);
      setOverlay(null);
      showToast("Đã đăng xuất.");
    } catch (error) {
      showToast(firebaseErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  };
  // The verification link is opened in the user's inbox. Afterwards,
  // the user returns to the login screen and signs in normally.
  const doVerify = () => {
    setVerificationOpen(false);
    setHistory([9]);
    setOverlay(null);
    showToast("Nếu đã xác minh email, hãy đăng nhập để tiếp tục.");
  };
  const doResend = async () => {
    if (authBusy) return;
    const email = (data.fields.email || "").trim();
    const password = data.fields.password || "";
    if (!email || !password) {
      showToast("Nhập email và mật khẩu trên màn hình đăng nhập để gửi lại liên kết.");
      return;
    }
    setAuthBusy(true);
    try {
      await resendVerificationWithCredentials(email, password);
      showToast("Đã gửi lại liên kết. Kiểm tra hộp thư và Spam.");
    } catch (error) { showToast(firebaseErrorMessage(error)); }
    finally { setAuthBusy(false); }
  };
  const getMetrics = () => calculateHealth({
    sex: (data.fields.sex === "female" ? "female" : data.fields.sex === "male" ? "male" : null),
    birthDate: data.fields.birthDate || "",
    heightCm: measurement(data.fields.height || ""),
    weightKg: measurement(data.fields.weight || ""),
    activityFactor: data.fields.activityFactor ? measurement(data.fields.activityFactor)
      : (data.choices["148:3610"] ? 1.55 : data.choices["148:3595"] ? 1.375 : 1.2),
  });
  const energyTarget = getMetrics()?.targetKcal ?? 2000;
  // A provisional macro split (25% protein / 50% carbs / 25% fat), not a clinical prescription.
  const macroTargetP = Math.round(energyTarget * .25 / 4);
  const macroTargetC = Math.round(energyTarget * .50 / 4);
  const macroTargetF = Math.round(energyTarget * .25 / 9);
  const saveHealth = async (complete = false) => {
    if (!authUser?.emailVerified) { setVerificationOpen(true); return false; }
    const metrics = getMetrics();
    if (!metrics) {
      showToast("Nhập giới tính, ngày sinh (DD/MM/YYYY), chiều cao và cân nặng hợp lệ.");
      return false;
    }
    setProfileLoading(true);
    try {
      await saveHealthProfile(authUser.uid, {
        sex: data.fields.sex as BiologicalSex,
        birthDate: data.fields.birthDate,
        heightCm: metrics.heightCm,
        weightKg: metrics.weightKg,
        activityFactor: metrics.activityFactor,
        // Body fat estimate is derived, never stored as a measured result.
        ...((data.fields.bodyFat && Number.isFinite(measurement(data.fields.bodyFat)))
          ? {bodyFatMeasuredPercent: measurement(data.fields.bodyFat)} : {}),
        ...(complete ? {setupComplete: true} : {}),
      });
      if (complete) patch({setupComplete:true});
      showToast("Đã lưu thông tin thành công!");
      return true;
    } catch (error) { showToast(firebaseErrorMessage(error)); return false; }
    finally { setProfileLoading(false); }
  };
  const saveName = async (name:string) => {
    if (!authUser?.emailVerified) {setVerificationOpen(true);return false;}
    try { await changeDisplayName(authUser.uid,name); setDisplayName(name.trim()); showToast("Đã lưu tên thành công!"); return true; }
    catch (error) {showToast(firebaseErrorMessage(error));return false;}
  };
  const cancelPending = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  }, []);
  const closeOverlay = useCallback(() => {
    cancelPending();
    setOverlay(null);
  }, [cancelPending]);
  const go = useCallback((n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > screens.length) return;
    cancelPending();
    setOverlay(null);
    setEditor(null);
    setHistory((h) => (h[h.length - 1] === n ? h : [...h, n]));
    if (n === 47) {
      setTimer(30);
      setTimerPaused(false);
    }
  }, [cancelPending]);
  const back = useCallback(() => {
    cancelPending();
    if (directory) {
      setDirectory(false);
      return;
    }
    if (editor) {
      setEditor(null);
      return;
    }
    if (overlay) {
      setOverlay(null);
      return;
    }
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : [1]));
  }, [overlay, editor, directory, cancelPending]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  useEffect(() => {
    const apply = (url: string | null | undefined) => {
      if (!url) return;
      const match = url.match(/[?&]screen=(\d+)(?:&|#|$)/);
      const n = Number(match?.[1]);
      if (Number.isInteger(n) && n >= 1 && n <= screens.length) go(n);
    };
    void Linking.getInitialURL().then(apply);
    const listener = Linking.addEventListener("url", (e) => apply(e.url));
    return () => listener.remove();
  }, [go]);
  useEffect(() => {
    if (current !== 47 || timerPaused || timer === 0) return;
    const id = setTimeout(() => setTimer((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(id);
  }, [current, timer, timerPaused]);
  useEffect(() => {
    if (current === 47 && timer === 0) {
      go(46);
      showToast("Đã hoàn thành 30 giây.");
    }
  }, [timer, current, go, showToast]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  const bindings = useMemo(() => {
    const inputs: SceneActions["inputBindings"] = {},
      roots: Record<string, boolean> = {},
      values: Record<string, string> = {};
    const assign = (
      root: DesignNode,
      key: string,
      valueNode: DesignNode,
      initial?: string,
      password = false,
      numeric = false,
    ) => {
      if (!valueNode.id) return;
      inputs[valueNode.id] = {
        key,
        initial,
        password,
        numeric,
        placeholder: initial ? undefined : content(valueNode),
      };
      if (root.id) roots[root.id] = true;
    };
    for (const sc of screens)
      visit(sc.tree, (n) => {
        const label = n.name || "";
        const texts = textNodes(n);
        if (!texts.length) return;
        if (
          /^Metric \/ (Calculated|Macro)/.test(label) &&
          n.id &&
          texts[1]?.id
        ) {
          values[texts[1].id] = n.id;
        }
        if (
          sc.number === 62 &&
          n.id &&
          nav[n.id]?.includes("240:4474") &&
          texts[1]?.id
        ) {
          values[texts[1].id] = /Chiều cao/.test(content(texts[0]))
            ? "height"
            : "weight";
        }
        if (/^Open \/ (Email|Mật khẩu)/.test(label))
          assign(
            n,
            label.includes("Mật khẩu") ? "password" : "email",
            texts[1] || texts[0],
            undefined,
            label.includes("Mật khẩu"),
          );
        else if (
          /^Metric \/ /.test(label) &&
          !label.includes("Calculated") &&
          !label.includes("Macro")
        ) {
          const field = label.includes("Chiều cao")
            ? "height"
            : label.includes("Cân nặng")
              ? "weight"
              : label.includes("Tỉ lệ mỡ")
                ? "bodyFat"
                : null;
          if (field && texts[1] && field !== "bodyFat")
            assign(n, field, texts[1], undefined, false, true);
        } else if (label === "V4 / Input / Field") {
          const target = texts.find((t) => /Viết câu hỏi/.test(content(t)));
          if (target) assign(n, "chat", target);
        }
      });
    return { inputs, roots, values };
  }, []);

  const press = (node: DesignNode) => {
    cancelPending();
    const name = node.name || "",
      text = content(node).trim(),
      targets = nav[node.id || ""] || [];
    const known = targets.map((id) => byId.get(id)).find(Boolean);
    const mealTypeLabels: Record<MealType,string> = {breakfast:"Bữa sáng", lunch:"Bữa trưa", dinner:"Bữa tối", snack:"Bữa phụ"};
    // The three visual meal cards keep old Figma links. Select the actual logged
    // meal instead, so no card can open sample oatmeal/recipe information.
    if (current === 21 && ["152:3490", "152:3494", "152:3498"].includes(node.id || "")) {
      const cardIndex = ["152:3490", "152:3494", "152:3498"].indexOf(node.id || "");
      const sortedMeals = [...meals].sort((a,b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0));
      const pickedMeal = sortedMeals[cardIndex];
      if (!pickedMeal) {
        showToast("Bạn chưa thêm món ăn ở mục này.");
        return;
      }
      setSelectedMeal(pickedMeal);
      go(27);
      return;
    }
    // The detail and nutrition popup must use the selected meal, never the
    // static Figma recommendation. Do not duplicate the meal on save.
    if (current === 27 && selectedMeal && !overlay && node.id === "209:4192") {
      showToast("Món ăn này đã có trong nhật ký hôm nay.");
      return;
    }
    if (overlay === "195:4419" && selectedMeal && node.id === "195:4424") {
      closeOverlay();
      return;
    }
    const followPrototype = () => {
      if (targets.includes("@back")) {
        back();
        return true;
      }
      if (targets.includes("195:3865")) {
        setOverlay("195:3865");
        pending.current = setTimeout(
          () => go(/Lịch tập|Vận động/.test(text) ? 79 : 78),
          900,
        );
        return true;
      }
      if (targets.includes("195:4292") || targets.includes("195:4331")) {
        setOverlay("195:4292");
        pending.current = setTimeout(() => go(24), 900);
        return true;
      }
      if (known) {
        go(known.number);
        return true;
      }
      const target = targets.find((id) => overlayById.has(id));
      if (target) {
        setOverlay(target);
        return true;
      }
      if (targets.includes("@close")) {
        closeOverlay();
        return true;
      }
      return false;
    };
    if (current === 96 && node.id === "202:4005") {
      go(13); return;
    }
    if (current === 13 && node.id === "501:8427") {
      setEditor({label:"Tỷ lệ mỡ đã đo (%) — tùy chọn",key:"bodyFat",value:data.fields.bodyFat || ""});
      return;
    }
    if (current === 13 && (node.id === "148:3548" || node.id === "148:3550")) {
      setEditor({label:"Giới tính (Nam hoặc Nữ)",key:"sex",value:data.fields.sex === "female" ? "Nữ" : "Nam"});
      return;
    }
    if (current === 13 && (node.id === "148:3551" || node.id === "148:3553")) {
      setEditor({label:"Ngày sinh (DD/MM/YYYY)",key:"birthDate",value:data.fields.birthDate ? formatBirthday(data.fields.birthDate) : ""});
      return;
    }
    if (current === 96 && (node.id === "202:4002" || node.id === "202:4003")) {
      setEditor({label:"Tên hiển thị",key:"displayName",value:displayName});
      return;
    }
    if (overlay === "202:3784" && (node.id === "202:3787" || node.id === "202:3790")) {
      patch({ appearance: node.id === "202:3790" ? "dark" : "light" });
      closeOverlay();
      return;
    }
    const choiceIds: string[] = [];
    if (name.startsWith("Choose")) {
      const choiceScreen = overlay ? overlayById.get(overlay) : screen;
      visit((choiceScreen || screen).tree, (n) => {
        if (n.name?.startsWith("Choose") && n.id) choiceIds.push(n.id);
      });
      const multi =
        !overlay &&
        [15, 17, 26, 37, 40, 51, 52, 58, 74, 84, 93, 99].includes(current);
      setChoice(
        node.id!,
        !(data.choices[node.id!] ?? initialChoice(node)),
        multi ? [] : choiceIds,
      );
      if (current === 14) {
        setField("activityFactor", node.id === "148:3610" ? "1.55" : node.id === "148:3595" ? "1.375" : "1.2");
      }
      if (overlay) {
        setField("setting:" + overlay, text);
        if (targets.includes("@close")) closeOverlay();
      }
      return;
    }
    if (name.startsWith("Reminder switch")) {
      patch({
        reminders: {
          ...data.reminders,
          [node.id!]: !(data.reminders[node.id!] ?? true),
        },
      });
      return;
    }
    if (overlay) {
      if (followPrototype()) return;
      if (!/Đóng|Hiểu rồi|Tiếp tục|Xong|Đã hiểu/.test(text)) {
        setField("setting:" + overlay, text);
        showToast("Đã chọn " + text + ".");
      }
      closeOverlay();
      return;
    }
    if (authUser && !verified && ![9,10,11,12].includes(current)) {
      setVerificationOpen(true);
      return;
    }
    if (current === 9 && /Đăng nhập/.test(text)) {
      void doLogin();
      return;
    }
    if (current === 10 && /Tạo tài khoản|Đăng ký/.test(text)) {
      void doRegister();
      return;
    }
    if (current === 11 && /Gửi mã xác thực/.test(text)) {
      // Actual Firebase reset-password email replaces the mock 6-digit OTP flow.
      void doResetPassword();
      return;
    }
    if (current === 12 && /Điền mã/.test(text)) {
      setEditor({
        label: "Mã xác thực gồm 6 chữ số",
        key: "otp",
        value: data.fields.otp || "",
      });
      return;
    }
    if (current === 12 && /Xác nhận mã/.test(text)) {
      if (!/^\d{6}$/.test(data.fields.otp || "")) {
        showToast("Bạn điền đủ 6 chữ số nhé.");
        return;
      }
      go(13);
      return;
    }
    if (current === 12 && /Gửi lại mã/.test(text)) {
      showToast("Đã làm mới mã mẫu. Dùng 123456 để thử.");
      return;
    }
    if (current === 8 && /Tiếp tục/.test(text)) {
      let selected = false;
      visit(screen.tree, (n) => {
        if (n.name?.startsWith("Choose /") && data.choices[n.id!])
          selected = true;
      });
      if (!selected) {
        setOverlay("146:3233");
        return;
      }
      go(9);
      return;
    }
    if (current === 15 && /tiếp tục/i.test(text)) {
      let selected = false;
      visit(screen.tree, (n) => {
        if (
          n.name?.startsWith("Choose day") &&
          (data.choices[n.id!] ?? initialChoice(n))
        )
          selected = true;
      });
      if (!selected) {
        setOverlay("148:3690");
        return;
      }
      go(16);
      return;
    }
    if (current === 13 && /Lưu và tiếp tục/i.test(text)) {
      void (async()=>{if(await saveHealth()) go(14);})();
      return;
    }
    if (current >= 14 && current <= 18 && /tiếp tục|Xem lại kế hoạch/i.test(text)) {
      go(current + 1);
      return;
    }
    if (current === 17 && /Tính nhu cầu/.test(text)) {
      go(18);
      return;
    }
    if (current === 19 && /Lưu kế hoạch/.test(text)) {
      void (async()=>{ if(await saveHealth(true)) go(20); })();
      return;
    }
    if (current === 36 && /Ghi 250 ml/.test(text)) {
      void recordWater(250);
      return;
    }
    if (current === 21 && /Thêm món ăn/.test(text)) {
      setMealEditor(true);
      return;
    }
    if (current === 49 && /Giảm/.test(text)) {
      patch({ repetitions: Math.max(1, (data.repetitions ?? 12) - 1) });
      return;
    }
    if (current === 49 && /Tăng/.test(text)) {
      patch({ repetitions: Math.min(30, (data.repetitions ?? 12) + 1) });
      return;
    }
    if (current === 47 && /Tạm dừng|Tiếp tục/.test(text)) {
      setTimerPaused((p) => !p);
      return;
    }
    if (/Lưu món/.test(text)) {
      patch({ savedMeal: !data.savedMeal });
      setOverlay("146:3278");
      return;
    }
    if (/Thêm vào nhật ký/.test(text)) {
      // The Figma recognition screen is a mock, NOT a real AI scan.
      // Only log its explicitly shown sample nutrition values after a tap.
      void recordMeal(true);
      return;
    }
    if (current === 88 && /Đánh dấu hoàn thành/.test(text)) {
      setChallengeDays((n) => Math.min(7, n + 1));
      showToast("Đã ghi nhận hôm nay.");
      return;
    }
    if (current === 65 && /^Edit \/ /.test(name)) {
      const key = name.includes("đi ngủ") ? "bedtime" : "wakeTime";
      setEditor({
        label: name.replace("Edit / ", ""),
        key,
        value: data.fields[key] || (key === "bedtime" ? "23:15" : "06:45"),
      });
      return;
    }
    if (targets.includes("240:4474")) {
      if (name.includes("Calculated") || name.includes("Macro")) {
        showToast("Chỉ số được tính tự động từ hồ sơ cơ thể.");
        return;
      }
      if (current === 62) {
        const key = /Chiều cao/.test(text) ? "height" : "weight";
        setEditor({
          label: key === "height" ? "Chiều cao (cm)" : "Cân nặng (kg)",
          key,
          value: data.fields[key] || (key === "height" ? "168" : "62"),
        });
        return;
      }
      setEditor({
        label: "Bạn muốn EcoFit giúp gì?",
        key: "chat",
        value: data.fields.chat || "",
      });
      return;
    }
    if (followPrototype()) return;
    if (name.startsWith("Tab /")) {
      const map: Record<string, number> = {
        home: 1,
        meal: 2,
        workout: 3,
        chart: 5,
        user: 96,
      };
      go(map[name.slice(6)] || 1);
      return;
    }
    if (name === "Frame" && /^\d+ ngày$/.test(text)) {
      setField("challengeLength", text);
      showToast("Đã chọn " + text + ".");
      return;
    }
    if (current === 62 && /Lưu|Cập nhật/.test(text)) {
      void saveHealth(); return;
    }
    if (/Lưu|Cập nhật|Áp dụng|Hoàn thành/.test(text)) {
      showToast("Đã cập nhật thay đổi.");
      return;
    }
    if (node.id) {
      setChoice(node.id, !data.choices[node.id]);
      showToast("Đã cập nhật lựa chọn.");
    }
  };
  const submit = (key: string) => {
    if (key === "chat" && (data.fields.chat || "").trim()) {
      patch({ chat: data.fields.chat });
      setField("chat", "");
      go(77);
      showToast("Đã tạo gợi ý mẫu cho bạn.");
    }
  };
  const actions: SceneActions = {
    onPress: press,
    onDirectory: () => {
      cancelPending();
      setDirectory(true);
    },
    onField: setField,
    onSubmit: submit,
    fields: data.fields,
    choices: {
      ...data.choices,
      "202:3787": data.appearance === "light",
      "202:3790": data.appearance === "dark",
    },
    reminders: data.reminders,
    inputBindings: bindings.inputs,
    inputRoots: bindings.roots,
    scrollPositions: scrollPositions.current,
    topInset: insets.top,
    bottomInset: insets.bottom,
    text: (node, text) => {
      const metrics = getMetrics();
      if (selectedMeal && current === 27) {
        const meal = selectedMeal;
        const labels: Record<MealType,string> = {breakfast:"Bữa sáng",lunch:"Bữa trưa",dinner:"Bữa tối",snack:"Bữa phụ"};
        const n = (v:number) => v.toLocaleString("vi-VN",{maximumFractionDigits:2});
        // Nutrition popup content uses the saved Firestore entry. Ingredients
        // are deliberately not invented because the add-meal form has none.
        if (overlay === "195:4419") {
          if (node.id === "195:4420") return meal.name;
          if (node.id === "195:4421") return `${labels[meal.mealType]} · Các chỉ số bạn đã nhập`;
          if (text === "310 kcal · 18 g đạm") return `${n(meal.calories)} kcal · ${n(meal.proteinGrams)} g protein`;
          if (text === "Yến mạch, trái cây và sữa.") return `Carb: ${n(meal.carbsGrams)} g · Fat: ${n(meal.fatGrams)} g`;
          if (text === "Thay sữa phù hợp với sở thích của bạn.") return "Bạn chưa nhập danh sách nguyên liệu cho món ăn này.";
          if (text === "Xem gợi ý bữa sáng") return "Xem món ăn";
          if (text === "Quay lại kết quả") return "Đóng chi tiết";
        } else {
          if (node.id === "209:4166") return labels[meal.mealType].toUpperCase();
          if (node.id === "209:4168") return `${labels[meal.mealType]} của bạn`;
          if (node.id === "209:4169") return `Thông tin dinh dưỡng đã lưu ngày ${vietnamKeyLabel(meal.dateKey)}.`;
          if (node.id === "209:4176") return meal.name;
          if (node.id === "209:4177") return `${n(meal.calories)} kcal · P ${n(meal.proteinGrams)} g · C ${n(meal.carbsGrams)} g · F ${n(meal.fatGrams)} g`;
          if (node.id === "I209:4178;121:2603") return `Protein ${n(meal.proteinGrams)} g · Carb ${n(meal.carbsGrams)} g · Fat ${n(meal.fatGrams)} g`;
          if (node.id === "I209:4192;143:3230") return "Đã có trong nhật ký";
        }
      }
      if (current === 1) {
        const remaining = Math.max(0, energyTarget - totals.calories);
        if (node.id === "244:4493") return journalLoaded ? Math.round(totals.calories).toLocaleString("vi-VN") : "—";
        if (node.id === "244:4494") return `/ ${Math.round(energyTarget).toLocaleString("vi-VN")} kcal`;
        if (node.id === "244:4495") return journalLoaded ? `Còn lại ${Math.round(remaining).toLocaleString("vi-VN")} kcal` : "Đang tải nhật ký...";
        if (node.id === "244:4499") return journalLoaded ? `${Math.round(energyTarget > 0 ? 100 * totals.calories/energyTarget : 0)}%` : "—";
        if (node.id === "244:4551") return journalLoaded ? `${(drankMl/1000).toLocaleString("vi-VN",{maximumFractionDigits:2})} L` : "—";
        if (node.id === "244:4466") return `Chào ${displayName || authUser?.email?.split("@")[0] || "bạn"}`;
        if (metrics) {
          if (node.id === "244:4494") return `/ ${metrics.targetKcal.toLocaleString("vi-VN")} kcal`;
          if (node.id === "244:4495") return "Lượng đã ăn: dữ liệu minh họa";
        }

      }
      if (current === 21) {
        const labels: Record<MealType,string> = {breakfast:"Bữa sáng",lunch:"Bữa trưa",dinner:"Bữa tối",snack:"Bữa phụ"};
        const amount = Math.round(totals.calories).toLocaleString("vi-VN");
        const remaining = Math.round(Math.max(0,energyTarget-totals.calories)).toLocaleString("vi-VN");
        if (node.id === "152:3482") return vietnamDateLabel().toUpperCase();
        if (node.id === "I152:3484;143:3249") return journalLoaded ? `${amount} kcal` : "Đang tải...";
        if (node.id === "I152:3487;143:3249") return journalLoaded ? `${remaining} kcal` : "—";
        const idx = ["152:3491", "152:3495", "152:3499"].indexOf(node.id || "");
        const idx2 = ["152:3492", "152:3496", "152:3500"].indexOf(node.id || "");
        const sorted = meals.slice().sort((a,b) => ((b.createdAt as any)?.seconds || 0)-((a.createdAt as any)?.seconds || 0));
        if (idx >= 0) return sorted[idx] ? labels[sorted[idx].mealType] : "Chưa có bữa ăn";
        if (idx2 >= 0) return sorted[idx2] ? `${sorted[idx2].name} · ${sorted[idx2].calories} kcal · P${sorted[idx2].proteinGrams}` : "Nhấn + Thêm món ăn để ghi nhật ký";
      }
      if (current === 34) {
        if (node.id === "I207:3950;143:3249") return `${Math.round(totals.calories).toLocaleString("vi-VN")} kcal`;
        if (node.id === "I207:3953;143:3249") return `${Math.round(energyTarget).toLocaleString("vi-VN")} kcal`;
        if (node.id === "207:3959") return `${Math.round(totals.proteinGrams)} / ${macroTargetP} g`;
        if (node.id === "207:3964") return `${Math.round(totals.carbsGrams)} / ${macroTargetC} g`;
        if (node.id === "207:3969") return `${Math.round(totals.fatGrams)} / ${macroTargetF} g`;
        if (node.id === "207:3960") return `4 kcal / g · còn khoảng ${Math.max(0,macroTargetP-Math.round(totals.proteinGrams))} g`;
        if (node.id === "207:3965") return `4 kcal / g · còn khoảng ${Math.max(0,macroTargetC-Math.round(totals.carbsGrams))} g`;
        if (node.id === "207:3970") return `9 kcal / g · còn khoảng ${Math.max(0,macroTargetF-Math.round(totals.fatGrams))} g`;
      }
      if (current === 35) {
        if (node.id === "I157:3532;143:3249") return `${Math.round(totals.calories).toLocaleString("vi-VN")} kcal`;
        if (node.id === "I157:3535;143:3249") return `${Math.round(energyTarget).toLocaleString("vi-VN")} kcal`;
        if (node.id === "157:3542") return `${Math.round(energyTarget > 0 ? totals.calories / energyTarget * 100 : 0)}%`;
        if (node.id === "157:3580") return `Còn lại ${Math.round(Math.max(0, energyTarget - totals.calories)).toLocaleString("vi-VN")} kcal`;
      }
      if (current === 36) {
        if (node.id === "192:3390") return journalLoaded ? `${drankMl.toLocaleString("vi-VN")} ml` : "Đang tải...";
        if (node.id === "I192:3395;143:3249") return `${Math.max(0, waterGoalMl - drankMl).toLocaleString("vi-VN")} ml`;
        if (node.id === "I192:3398;143:3249") return `${waterEntries.length} lần`;
      }
      if (current === 13) {
        if (node.id === "148:3550") return data.fields.sex === "female" ? "Nữ" : data.fields.sex === "male" ? "Nam" : "Chọn giới tính";
        if (node.id === "148:3553") return data.fields.birthDate ? formatBirthday(data.fields.birthDate) : "Chọn ngày sinh";
        if (node.id === "I501:8427;143:3249") return data.fields.bodyFat ? `${data.fields.bodyFat}% (đã đo)` : metrics?.bodyFatEstimatePercent != null ? `~${metrics.bodyFatEstimatePercent}%` : "Chưa có";
      }
      if (current === 18 && metrics) {
        const values: Record<string,string> = {
          "I493:8416;143:3249": `${metrics.bmrKcal.toLocaleString("vi-VN")} kcal`,
          "I493:8419;143:3249": `${metrics.tdeeKcal.toLocaleString("vi-VN")} kcal`,
          "I493:8422;143:3249": `${metrics.targetKcal.toLocaleString("vi-VN")} kcal`,
        };
        if (node.id && values[node.id]) return values[node.id];
      }
      if (current === 19 && metrics) {
        if (node.id === "151:3444") return `${metrics.sexLabel} · ${metrics.age} tuổi · ${metrics.heightCm} cm · ${metrics.weightKg} kg`;
        if (node.id === "151:3460") return `${metrics.targetKcal.toLocaleString("vi-VN")} kcal / ngày`;
        if (node.id === "I151:3463;143:3249") return `${metrics.tdeeKcal.toLocaleString("vi-VN")} kcal`;
        if (node.id === "I151:3466;143:3249") return String(metrics.bmi);
      }
      if (current === 96 && node.id === "202:4003") return displayName || authUser?.email?.split("@")[0] || "Bạn";
      if (text.includes("Hương Giang")) return text.replace(/Hương Giang/g, displayName || authUser?.email?.split("@")[0] || "bạn");
      if (node.id === "I202:3823;121:2603")
        return data.appearance === "dark" ? "Tối" : "Sáng";
    if (overlay === "202:3784") {
        if (node.id === "I202:3787;143:3232" && data.appearance === "light")
          return "Sáng · Đang dùng";
        if (node.id === "I202:3790;143:3232" && data.appearance === "dark")
          return "Tối · Đang dùng";
      }
      const field = node.id && bindings.values[node.id];
      if (field && data.fields[field]?.trim()) {
        const unit = text.match(/\s(kcal|g)$/)?.[1];
        return field === "height"
          ? withUnit(data.fields[field], "cm")
          : field === "weight"
            ? withUnit(data.fields[field], "kg")
            : unit
              ? withUnit(data.fields[field], unit)
              : data.fields[field];
      }
      if (current === 19) {
        if (node.id === "151:3444") {
          let summary = text;
          if (data.fields.height?.trim())
            summary = summary.replace(
              /\d+(?:[.,]\d+)? cm/,
              withUnit(data.fields.height, "cm"),
            );
          if (data.fields.weight?.trim())
            summary = summary.replace(
              /\d+(?:[.,]\d+)? kg/,
              withUnit(data.fields.weight, "kg"),
            );
          return summary;
        }
        if (node.id === "151:3460" && data.fields["493:8422"]?.trim())
          return withUnit(data.fields["493:8422"], "kcal") + " / ngày";
        if (node.id === "I151:3463;143:3249" && data.fields["493:8419"]?.trim())
          return withUnit(data.fields["493:8419"], "kcal");
      }
      if (current === 62 && (data.fields.height || data.fields.weight)) {
        const height = data.fields.height || "168";
        const weight = data.fields.weight || "62";
        if (node.id === "244:5058")
          return withUnit(weight, "kg") + " · " + withUnit(height, "cm");
        if (node.id === "244:5057") {
          const bmi = measurement(weight) / (measurement(height) / 100) ** 2;
          if (Number.isFinite(bmi) && bmi > 0)
            return bmi.toLocaleString("vi-VN", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            });
        }
      }
      if (current === 47 && text === "30") return String(timer);
      if (current === 47 && /Tạm dừng đồng hồ/.test(text))
        return timerPaused ? "Tiếp tục đồng hồ" : text;
      if (current === 49 && text === "12" && data.repetitions !== null)
        return String(data.repetitions);
      if (current === 12 && text === "— — — — — —" && data.fields.otp)
        return data.fields.otp.split("").join(" ");
      if (current === 88 && text === "0 / 7 ngày" && challengeDays)
        return challengeDays + " / 7 ngày";
      if (current === 65) {
        if (text === "23:15" && data.fields.bedtime) return data.fields.bedtime;
        if (text === "06:45" && data.fields.wakeTime)
          return data.fields.wakeTime;
      }
      return text;
    },
  };
  if (!loaded || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 24, color: colors.accent }}>
          {fontError
            ? "Không tải được font. Mở lại ứng dụng để thử lại."
            : "EcoFit."}
        </Text>
      </View>
    );
  }
  const activeOverlay = overlay ? overlayById.get(overlay) : null;
  const frameWidth =
    Platform.OS === "web" ? Math.min(390, dimensions.width) : dimensions.width;
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: "center" }}>
      <StatusBar barStyle={isDark || [6, 46, 47].includes(current) ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          width: frameWidth,
          maxWidth: Platform.OS === "web" ? 390 : undefined,
          overflow: "hidden",
        }}
      >
        <SplashMotion active={current === 6}>
          <NativeScene screen={screen} actions={actions} />
        </SplashMotion>
        {current === 96 && authUser && (
          <Pressable
            onPress={() => void doLogout()}
            disabled={authBusy}
            accessibilityLabel="Đăng xuất tài khoản Firebase"
            style={{ position: "absolute", right: 16, top: Math.max(insets.top + 8, 48),
              zIndex: 15, backgroundColor: colors.surface, borderColor: colors.border,
              borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}
          >
            <Text style={{ color: colors.text, fontFamily: bodyFont, fontSize: 12 }}>
              {authBusy ? "Đang xử lý..." : "Đăng xuất"}
            </Text>
          </Pressable>
        )}
        {current === 36 && authUser?.emailVerified && (
          <Pressable onPress={() => setWaterEditor(true)} accessibilityLabel="Nhập lượng nước khác"
            style={{position:"absolute",right:16,bottom:115,zIndex:11,padding:12,borderRadius:14,backgroundColor:colors.primary}}>
            <Text style={{fontFamily:bodyFont,color:colors.onAccent}}>+ Lượng khác</Text>
          </Pressable>
        )}
        {(current === 21 || current === 36) && authUser?.emailVerified && (
          <Pressable
            onPress={() => openJournalHistory(current === 21 ? "meal" : "water")}
            style={{
              position:"absolute",
              alignSelf:"center",
              bottom: current === 21 ? 178 : 182,
              zIndex:11,
              paddingHorizontal:16,
              paddingVertical:10,
              borderRadius:14,
              backgroundColor:colors.surface,
              borderWidth:1,
              borderColor:colors.border,
            }}
          >
            <Text style={{color:colors.text,fontFamily:bodyFont}}>{current === 21 ? "Xem nhật ký theo ngày" : "Xem lịch sử uống nước"}</Text>
          </Pressable>
        )}
        {toast !== "" && (
          <View
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            style={{
              position: "absolute",
              left: 20,
              right: 20,
              bottom: 110,
              borderRadius: 16,
              padding: 16,
              backgroundColor: colors.toast,
              zIndex: 20,
            }}
          >
            <Text
              style={{ fontFamily: bodyFont, color: colors.onToast, fontSize: 14 }}
            >
              {toast}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
      <Modal visible={journalListOpen !== null} transparent animationType="slide" onRequestClose={()=>setJournalListOpen(null)}>
        <View style={{flex:1,backgroundColor:colors.scrim,justifyContent:"center",padding:16}}>
          <View style={{backgroundColor:colors.surface,borderRadius:22,padding:18,maxHeight:"82%",gap:12}}>
            <Text style={{fontFamily:titleFont,fontSize:20,color:colors.text}}>{journalListOpen==="meal"?"Nhật ký ăn uống":"Lịch sử uống nước"}</Text>
            <Text style={{fontFamily:bodyFont,color:colors.muted,fontSize:12}}>Chọn ngày để xem lại dữ liệu đã lưu (giờ Việt Nam).</Text>
            <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <Pressable accessibilityLabel="Xem ngày trước" onPress={()=>setHistoryDateKey(day=>shiftVietnamDateKey(day,-1))}
                style={{paddingVertical:10,paddingHorizontal:14,borderRadius:12,backgroundColor:colors.input}}>
                <Text style={{color:colors.text,fontSize:18}}>‹</Text>
              </Pressable>
              <View style={{flex:1,alignItems:"center"}}>
                <Text style={{fontFamily:bodyFont,color:colors.text,fontSize:14,textAlign:"center"}}>{vietnamKeyLabel(historyDateKey)}</Text>
                <Text style={{color:colors.muted,fontSize:11}}>{historyIsToday?"Hôm nay":"Ngày đã chọn"}</Text>
              </View>
              <Pressable accessibilityLabel="Xem ngày sau" disabled={historyDateKey >= dateKey}
                onPress={()=>setHistoryDateKey(day=>shiftVietnamDateKey(day,1))}
                style={{paddingVertical:10,paddingHorizontal:14,borderRadius:12,backgroundColor:colors.input,opacity:historyDateKey>=dateKey?0.3:1}}>
                <Text style={{color:colors.text,fontSize:18}}>›</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingVertical:2}}>
              {historyQuickDays.map(day=>(
                <Pressable key={day} accessibilityLabel={`Xem nhật ký ngày ${day}`}
                  onPress={()=>setHistoryDateKey(day)}
                  style={{backgroundColor:historyDateKey===day?colors.primary:colors.input,paddingVertical:8,paddingHorizontal:10,borderRadius:10}}>
                  <Text style={{color:historyDateKey===day?colors.onAccent:colors.text,fontSize:12}}>{day.slice(8,10)}/{day.slice(5,7)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {!historyIsToday && (
              <Pressable accessibilityLabel="Quay lại ngày hôm nay" onPress={()=>setHistoryDateKey(dateKey)}
                style={{padding:9,alignItems:"center",borderRadius:10,borderWidth:1,borderColor:colors.border}}>
                <Text style={{color:colors.text}}>Về hôm nay</Text>
              </Pressable>
            )}
            {!historyLoaded ? <Text style={{color:colors.muted}}>Đang tải dữ liệu ngày đã chọn...</Text> :
              historyError ? <Text style={{color:"#ff8d88"}}>{historyError}</Text> :
              <View style={{backgroundColor:colors.input,padding:12,borderRadius:12}}>
                <Text style={{fontFamily:bodyFont,color:colors.text}}>{journalListOpen==="meal"
                  ? `${historyDayMealsTotal.count} món · ${Math.round(historyDayMealsTotal.calories).toLocaleString("vi-VN")} kcal`
                  : `${historyWater.length} lần uống · ${historyDayWaterTotal.toLocaleString("vi-VN")} ml`}</Text>
                {journalListOpen==="meal" && <Text style={{color:colors.muted,fontSize:12,marginTop:4}}>{`Protein ${historyDayMealsTotal.proteinGrams} g · Carb ${historyDayMealsTotal.carbsGrams} g · Fat ${historyDayMealsTotal.fatGrams} g`}</Text>}
              </View>
            }
            <ScrollView style={{maxHeight:280}} nestedScrollEnabled>
              {historyLoaded && !historyError && journalListOpen==="meal" && historyMeals.map(m=>(
                <View key={m.id} style={{paddingVertical:12,borderBottomWidth:1,borderColor:colors.border,flexDirection:"row",alignItems:"center",gap:8}}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${m.name}`}
                    onPress={()=>{setJournalListOpen(null);setSelectedMeal(m);go(27);}} style={{flex:1}}>
                    <Text style={{color:colors.text,fontFamily:bodyFont}}>{m.name}</Text>
                    <Text style={{color:colors.muted,fontSize:12}}>{({breakfast:"Bữa sáng",lunch:"Bữa trưa",dinner:"Bữa tối",snack:"Bữa phụ"} as Record<MealType,string>)[m.mealType]} · {m.calories} kcal</Text>
                    <Text style={{color:colors.muted,fontSize:11}}>P {m.proteinGrams} g · C {m.carbsGrams} g · F {m.fatGrams} g</Text>
                  </Pressable>
                  <Pressable accessibilityLabel={`Xóa món ${m.name}`} disabled={journalBusy}
                    onPress={()=>{setJournalBusy(true);void deleteMeal(m.id).catch(()=>showToast("Không xóa được món ăn.")).finally(()=>setJournalBusy(false));}}
                    style={{padding:8}}><Text style={{color:"#ff8d88"}}>Xóa</Text></Pressable>
                </View>
              ))}
              {historyLoaded && !historyError && journalListOpen==="water" && historyWater.map(w=>(
                <View key={w.id} style={{paddingVertical:12,borderBottomWidth:1,borderColor:colors.border,flexDirection:"row",alignItems:"center"}}>
                  <Text style={{flex:1,color:colors.text}}>{w.amountMl} ml</Text>
                  <Pressable accessibilityLabel={`Xóa lần uống ${w.amountMl} ml`} disabled={journalBusy}
                    onPress={()=>{setJournalBusy(true);void deleteWater(w.id).catch(()=>showToast("Không xóa được lần uống.")).finally(()=>setJournalBusy(false));}}
                    style={{padding:8}}><Text style={{color:"#ff8d88"}}>Xóa</Text></Pressable>
                </View>
              ))}
              {historyLoaded && !historyError && journalListOpen==="meal" && historyMeals.length===0 &&
                <Text style={{color:colors.muted,paddingVertical:12}}>Chưa có món ăn nào trong ngày này.</Text>}
              {historyLoaded && !historyError && journalListOpen==="water" && historyWater.length===0 &&
                <Text style={{color:colors.muted,paddingVertical:12}}>Chưa ghi nước uống trong ngày này.</Text>}
            </ScrollView>
            <Pressable onPress={()=>setJournalListOpen(null)} style={{padding:12,alignItems:"center",borderRadius:12,backgroundColor:colors.input}}>
              <Text style={{color:colors.text}}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={mealEditor} transparent animationType="slide" onRequestClose={() => setMealEditor(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex:1,justifyContent:"center",backgroundColor:colors.scrim,padding:20}}>
          <View style={{backgroundColor:colors.surface,padding:20,borderRadius:22,gap:10}}>
            <Text style={{fontSize:20,fontFamily:titleFont,color:colors.text}}>Thêm bữa ăn hôm nay</Text>
            <TextInput placeholder="Tên món ăn" placeholderTextColor={colors.muted} value={mealDraft.name}
              onChangeText={name => setMealDraft(v=>({...v,name}))}
              style={{padding:12,borderRadius:10,backgroundColor:colors.input,color:colors.text}} />
            <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
              {([['breakfast','Sáng'],['lunch','Trưa'],['dinner','Tối'],['snack','Phụ']] as [MealType,string][]).map(([type,label])=>(
                <Pressable key={type} onPress={()=>setMealDraft(v=>({...v,mealType:type}))} style={{paddingHorizontal:13,paddingVertical:10,borderRadius:10,backgroundColor:mealDraft.mealType===type?colors.primary:colors.input}}>
                  <Text style={{color:mealDraft.mealType===type?colors.onAccent:colors.text}}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {([
              ['calories','Năng lượng','kcal'],
              ['proteinGrams','Protein','g'],
              ['carbsGrams','Carb','g'],
              ['fatGrams','Fat','g'],
            ] as [keyof typeof mealDraft,string,string][]).map(([key,label,unit])=>(
              <View key={key} style={{flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:12,paddingVertical:10,borderRadius:10,backgroundColor:colors.input}}>
                <View style={{paddingHorizontal:10,paddingVertical:8,borderRadius:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,minWidth:54,alignItems:"center"}}>
                  <Text style={{color:colors.text,fontFamily:bodyFont,fontSize:12}}>{unit}</Text>
                </View>
                <TextInput keyboardType="decimal-pad" placeholder={label} placeholderTextColor={colors.muted}
                  value={mealDraft[key]} onChangeText={val => setMealDraft(v=>({...v,[key]:val.replace(/[^0-9.,]/g,"")}))}
                  style={{flex:1,color:colors.text,paddingVertical:2}} />
              </View>
            ))}
            <Text style={{color:colors.muted,fontSize:12}}>Nhập thông tin dinh dưỡng theo nhãn thực phẩm hoặc khẩu phần đã biết. EcoFit chưa nhận diện món bằng AI.</Text>
            {journalError ? <Text style={{color:"#ff8d88",fontSize:13}}>{journalError}</Text> : null}
            <Pressable disabled={journalBusy} onPress={()=>void recordMeal()} style={{padding:14,borderRadius:12,backgroundColor:colors.primary,alignItems:"center"}}>
              <Text style={{color:colors.onAccent,fontFamily:bodyFont}}>{journalBusy?"Đang lưu...":"Lưu bữa ăn"}</Text>
            </Pressable>
            <Pressable onPress={()=>setMealEditor(false)} style={{padding:8,alignItems:"center"}}><Text style={{color:colors.text}}>Hủy</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={waterEditor} transparent animationType="fade" onRequestClose={()=>setWaterEditor(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios"?"padding":undefined} style={{flex:1,justifyContent:"center",backgroundColor:colors.scrim,padding:24}}>
          <View style={{padding:24,borderRadius:20,backgroundColor:colors.surface,gap:16}}>
            <Text style={{fontSize:20,fontFamily:titleFont,color:colors.text}}>Ghi lượng nước uống (ml)</Text>
            <TextInput value={waterAmount} onChangeText={setWaterAmount} keyboardType="number-pad"
              style={{padding:14,borderRadius:12,backgroundColor:colors.input,color:colors.text,fontSize:18}} />
            {journalError ? <Text style={{color:"#ff8d88",fontSize:13}}>{journalError}</Text> : null}
            <Pressable disabled={journalBusy} onPress={()=>{
              const ml = Number(waterAmount.trim());
              if (!Number.isInteger(ml)||ml<1||ml>5000) {setJournalError("Nhập lượng nước từ 1 đến 5000 ml.");return;}
              void recordWater(ml);
            }} style={{padding:14,borderRadius:12,alignItems:"center",backgroundColor:colors.primary}}>
              <Text style={{color:colors.onAccent}}>{journalBusy?"Đang lưu...":"Lưu lượng nước"}</Text>
            </Pressable>
            <Pressable onPress={()=>setWaterEditor(false)} style={{alignItems:"center",padding:8}}><Text style={{color:colors.text}}>Hủy</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={verificationOpen} transparent animationType="fade" onRequestClose={()=>setVerificationOpen(false)}>
        <View style={{flex:1,justifyContent:"center",padding:24,backgroundColor:colors.scrim}}>
          <View style={{backgroundColor:colors.surface,borderRadius:22,padding:24,gap:16}}>
            <Text style={{fontSize:22,fontFamily:titleFont,color:colors.text}}>Xác minh email</Text>
            <Text style={{fontFamily:bodyFont,color:colors.text,lineHeight:24}}>
              Tài khoản chưa thể đăng nhập. Hãy mở hộp thư {data.fields.email || authUser?.email}, bấm liên kết xác minh Firebase (kiểm tra cả Spam), rồi trở lại EcoFit để đăng nhập.
            </Text>
            <Pressable disabled={authBusy} onPress={()=>void doVerify()} style={{padding:16,borderRadius:14,backgroundColor:colors.primary,alignItems:"center"}}>
              <Text style={{fontFamily:bodyFont,color:colors.onAccent}}>Đến màn hình đăng nhập</Text>
            </Pressable>
            <Pressable disabled={authBusy} onPress={()=>void doResend()} style={{padding:12,alignItems:"center"}}>
              <Text style={{fontFamily:bodyFont,color:colors.text}}>Gửi lại liên kết (cần email và mật khẩu)</Text>
            </Pressable>
            <Pressable onPress={()=>setVerificationOpen(false)} style={{padding:8,alignItems:"center"}}><Text style={{color:colors.muted}}>Đóng</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(activeOverlay)}
        transparent
        animationType="fade"
        onRequestClose={closeOverlay}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.scrim,
          }}
        >
          <Pressable
            accessibilityLabel="Đóng hộp thoại"
            onPress={closeOverlay}
            style={{ position: "absolute", inset: 0 }}
          />
          {activeOverlay && (
            <View
              style={{
                width: Math.min(activeOverlay.width, dimensions.width - 40),
                height: Math.min(activeOverlay.height, dimensions.height - 80),
                borderRadius: 28,
                overflow: "hidden",
              }}
            >
              <NativeScene screen={activeOverlay} actions={actions} />
            </View>
          )}
        </View>
      </Modal>
      <Modal
        visible={editor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditor(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: colors.scrim,
          }}
        >
          <Pressable
            onPress={() => setEditor(null)}
            accessibilityLabel="Đóng nhập liệu"
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            style={{
              backgroundColor: colors.surface,
              padding: 24,
              paddingBottom: Math.max(24, insets.bottom),
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              gap: 16,
            }}
          >
            <Text
              style={{ fontFamily: titleFont, fontSize: 20, color: colors.text }}
            >
              {editor?.label}
            </Text>
            <TextInput
              autoFocus
              keyboardAppearance={isDark ? "dark" : "light"}
              accessibilityLabel={editor?.label}
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              value={editor?.value || ""}
              keyboardType={editor?.key === 'height' || editor?.key === 'weight' || editor?.key === 'bodyFat' ? 'decimal-pad' : 'default'}
              onChangeText={(value) =>
                setEditor((e) => (e ? { ...e, value: ['height','weight','bodyFat'].includes(e.key) ? value.replace(/[^0-9.,]/g,'') : value } : e))
              }
              style={{
                padding: 16,
                backgroundColor: colors.input,
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                fontFamily: bodyFont,
                fontSize: 18,
              }}
            />
            <Pressable
              onPress={() => {
                if (!editor) return;
                const { key, value } = editor;
                if (key === "displayName") {
                  if (!value.trim()) { showToast("Tên không được để trống."); return; }
                  void (async () => { if (await saveName(value)) setEditor(null); })();
                  return;
                }

                // Save personal metrics only after Firestore confirms success.
                // This prevents showing a success toast if the network write fails.
                const updates: Parameters<typeof saveHealthProfile>[1] = {};
                let normalizedValue = value;
                if (key === "sex") {
                  const normalized = value.trim().toLowerCase();
                  if (!["nam", "nữ", "nu", "male", "female"].includes(normalized)) {
                    showToast("Vui lòng nhập Nam hoặc Nữ."); return;
                  }
                  normalizedValue = ["nam", "male"].includes(normalized) ? "male" : "female";
                  updates.sex = normalizedValue as BiologicalSex;
                } else if (key === "birthDate") {
                  const iso = parseBirthday(value);
                  if (!iso) { showToast("Ngày sinh phải hợp lệ, theo DD/MM/YYYY."); return; }
                  normalizedValue = iso;
                  updates.birthDate = iso;
                } else if (key === "height" || key === "weight") {
                  const n = measurement(value);
                  if (!Number.isFinite(n) || n <= 0 ||
                    (key === "height" && (n < 80 || n > 250)) ||
                    (key === "weight" && (n < 20 || n > 350))) {
                    showToast("Chiều cao/cân nặng không hợp lệ."); return;
                  }
                  normalizedValue = String(n);
                  if (key === "height") updates.heightCm = n;
                  else updates.weightKg = n;
                } else if (key === "bodyFat") {
                  const n = measurement(value);
                  if (!Number.isFinite(n) || n < 2 || n > 75) {
                    showToast("Tỷ lệ mỡ phải trong khoảng 2–75%."); return;
                  }
                  normalizedValue = String(n);
                  updates.bodyFatMeasuredPercent = n;
                } else {
                  setField(key, value);
                  if (key === "chat") { patch({ chat: value }); go(77); }
                  setEditor(null);
                  return;
                }

                if (!authUser?.emailVerified) {
                  showToast("Vui lòng đăng nhập và xác minh email để lưu thay đổi.");
                  return;
                }
                void (async () => {
                  try {
                    await saveHealthProfile(authUser.uid, updates);
                    setField(key, normalizedValue);
                    setEditor(null);
                    showToast("Đã lưu thay đổi thành công!");
                  } catch (_error) {
                    showToast("Không thể lưu thay đổi. Vui lòng thử lại.");
                  }
                })();
              }}
              style={{
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: "Manrope_700Bold", color: colors.onAccent }}>
                Lưu
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <ScreenDirectory
        visible={directory}
        screens={screens}
        current={current}
        onClose={() => setDirectory(false)}
        onChoose={(n) => {
          setDirectory(false);
          go(n);
        }}
        onReset={() => {
          cancelPending();
          void reset();
          setOverlay(null);
          setEditor(null);
          scrollPositions.current = {};
          setDirectory(false);
          setHistory([6]);
          setChallengeDays(0);
          showToast("Đã đặt lại dữ liệu mẫu.");
        }}
      />
    </View>
  );
}
function ThemedFrontend() {
  const { data } = useDemo();
  return <ThemeProvider preference={data.appearance}><Frontend /></ThemeProvider>;
}
export default function App() {
  return (
    <SafeAreaProvider>
      <DemoProvider>
        <ThemedFrontend />
      </DemoProvider>
    </SafeAreaProvider>
  );
}
