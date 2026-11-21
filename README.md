# EcoFit — React Native / Expo + Firebase

Ứng dụng EcoFit gồm **100 màn hình** và **37 hộp thoại/trạng thái** dựng từ Figma (page *EcoFit V4 • Refined interface*, node `73:2`, file `QCszU0931h1RJ7EvUqfIok`). Đây là tài liệu **thống nhất** cho phiên bản source hiện tại; các hướng dẫn Firebase trước đây được gộp vào đây để tránh thông tin trùng hoặc lỗi thời.

**Trạng thái hiện tại:** Đã có lớp client tích hợp Firebase Authentication (email/mật khẩu, xác minh email, đăng nhập/đăng xuất/khôi phục mật khẩu) và Firestore (hồ sơ, chỉ số cơ thể). Đã kết nối **nhật ký ăn uống và nước uống theo ngày** với Firestore. Các phần luyện tập, giấc ngủ, gợi ý AI và một số màn hình khác vẫn dùng dữ liệu mô phỏng; không xem các giá trị đó là dữ liệu đo thực tế. Không nhầm các chỉ số demo với dữ liệu sức khỏe đã đo.

## 1. Cài đặt & chạy Expo

Yêu cầu Node.js tương thích với Expo SDK 58 và gói Firebase đã ghim; `package.json` khai báo `firebase: 12.0.0`. Nếu npm báo `EBADENGINE`, kiểm tra `node -v` và phiên bản package thực tế trước khi nâng cấp. Máy Windows với npm/Expo dùng các lệnh:

```bash
npm install
npm ls firebase
npm run typecheck
npx expo start -c
```

- Mở bằng **Expo Go tương thích SDK 58**; điện thoại và máy chạy Metro nên dùng chung Wi-Fi, hoặc thử `npx expo start --tunnel` khi LAN không truy cập được.
- Expo chạy trên iPhone có thể yêu cầu tài khoản Expo Go và Expo CLI đăng nhập cùng tài khoản (`npx expo whoami`, `npx expo login`).
- Nhấn `a` trong terminal để mở Android Emulator đã bật; trên macOS nhấn `i` để mở iOS Simulator.
- Chạy Web: `npm run web`.
- Nếu PowerShell chặn `npm.ps1`, thử `npm.cmd install`, `npm.cmd run typecheck` và `npx.cmd expo start -c`.
- Khi gặp `ECONNRESET`, cần kiểm tra kết nối npm trước khi cho rằng source bị lỗi. Với lỗi `EPERM` khi cài, dừng Metro/Emulator và các tiến trình đang giữ file.

### Android Emulator trên Windows

Mở AVD có sẵn trong **Android Studio → Device Manager**, rồi kiểm tra `adb devices`: trạng thái cần là `device`, không phải `unauthorized`. Nếu SDK được cài ở nơi khác thư mục mặc định, cấu hình đúng `ANDROID_HOME` và thêm `platform-tools` vào PATH. Ví dụ với máy có SDK tại `E:\DevTools\Android\Sdk`:

```powershell
$env:ANDROID_HOME = "E:\DevTools\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"
adb devices
npx expo start -c
```

Khi máy ảo có lỗi GPU/snapshot, thử Cold Boot trong Device Manager trước khi xóa dữ liệu AVD.

## 2. Thiết lập Firebase (bắt buộc)

1. Vào Firebase Console, chọn đúng Firebase project theo `.env` (source hiện dùng project ID `ecofit-4abc2`, nếu đã thay đổi cấu hình thì sử dụng project mới).
2. **Authentication → Sign-in method:** bật **Email/Password**.
3. **Firestore Database:** tạo database `(default)` nếu chưa có.
4. **Firestore Database → Rules:** copy toàn bộ nội dung của `firestore.rules` từ source rồi nhấn **Publish**. Chỉnh file cục bộ không tự cập nhật Rules trên Firebase.
5. Kiểm tra các trường `EXPO_PUBLIC_FIREBASE_*` trong `.env` theo phần **Project settings → General → Your apps → Web app → Config**. Thay đổi `.env` thì khởi động lại Metro.
6. Chạy `npm install`, `npm run typecheck`, `npx expo start -c` và thử trên thiết bị.

**Lưu ý bảo mật:** `EXPO_PUBLIC_*` có thể đọc được ở phía client, không dùng cho Firebase Admin private key, service-account JSON hoặc khóa AI bí mật. Quyền truy cập Firestore được quyết định bởi Auth + Rules; đây không phải nơi bảo vệ khóa máy chủ.

## 3. Luồng tài khoản & xác minh email

Các màn hình chính: **9 – Đăng nhập**, **10 – Đăng ký**, **11 – Quên mật khẩu**; màn hình **12** là mock OTP từ Figma, **không** phải OTP do Firebase Email/Password gửi.

### Đăng ký

1. Nhập email, mật khẩu (ít nhất 6 ký tự) rồi bấm **Tạo tài khoản**.
2. `registerUser()` gọi Firebase Authentication tạo tài khoản; tên mặc định là phần đứng trước `@` trong email.
3. Firebase gửi **email chứa liên kết xác minh** bằng `sendEmailVerification()` và ứng dụng đăng xuất phiên tạm.
4. Thông báo yêu cầu người dùng mở email (kiểm tra cả Spam). Nút “Tôi đã xác minh email” **không tự xác minh** tài khoản và không được vượt qua bước đăng nhập.
5. **Không đọc/ghi `users/{uid}` trước khi xác minh email.** Đây là cách tránh lỗi `permission-denied` từng xảy ra trong phiên bản cũ.

### Đăng nhập

1. Nhập email/mật khẩu; Firebase xác thực rồi ứng dụng gọi `reload(user)` để kiểm tra `emailVerified` mới nhất.
2. Nếu **chưa xác minh**, hệ thống từ chối vào app và đăng xuất. Có thể gửi lại email xác minh bằng luồng cung cấp email/mật khẩu; tránh gửi liên tục do Firebase giới hạn chống lạm dụng.
3. Nếu **đã xác minh**, làm mới token (`getIdToken(user, true)`), sau đó `ensureUserProfile()` đọc hoặc tạo `users/{uid}` trong Firestore.
4. Nếu `setupComplete=false`, mở quy trình thiết lập hồ sơ. Nếu hoàn tất, vào trang chủ.
5. Màn hình cá nhân có chức năng đăng xuất; quên mật khẩu gửi liên kết email (không phải mã OTP 6 số).

**Lưu ý:** Firebase Auth có thể tạo account thành công dù thao tác tiếp theo (gửi mail/kết nối mạng) lỗi. Nếu email báo đã tồn tại, kiểm tra Authentication → Users trước khi đăng ký lại.

## 4. Hồ sơ cá nhân & Firestore

Mỗi người dùng được lưu tại `users/{firebaseAuthUid}`; hồ sơ được tạo khi **đăng nhập thành công sau xác minh email**. Các trường dữ liệu chính:

| Trường | Ý nghĩa |
|---|---|
| `uid`, `email`, `name` | Định danh, email, tên hiển thị |
| `heightCm`, `weightKg` | Chiều cao (cm), cân nặng (kg), dưới dạng **số** |
| `sex`, `birthDate` | Giới tính dùng cho công thức và ngày sinh |
| `bodyFatMeasuredPercent` | Tỷ lệ mỡ **đo thực tế** (nếu có) |
| `activityFactor`, `goal` | Hệ số vận động và mục tiêu |
| `setupComplete` | Đã hoàn thành thiết lập hay chưa |
| `createdAt`, `updatedAt` | Dấu thời gian Firestore |

- **Màn hình 13:** chỉnh giới tính, ngày sinh (`DD/MM/YYYY`), chiều cao, cân nặng và tỷ lệ mỡ đo (nếu có). `cm` và `kg` là nhãn cố định, không nhập chung vào giá trị; dùng bàn phím số thập phân.
- **Lưu và tiếp tục:** dùng `saveHealthProfile()` cập nhật hồ sơ trong Firestore. Màn hình kế tiếp có thể lưu hệ số vận động và thông tin kế hoạch.
- **Lưu kế hoạch:** đánh dấu `setupComplete=true` khi hoàn thành luồng thiết lập.
- **Màn hình 96 – Cá nhân:** đổi tên hiển thị và lưu vào Firestore/Firebase Auth; mở “Hồ sơ và mục tiêu” để sửa số đo. Trang chủ chào theo tên người dùng thay vì tên mẫu từ Figma.
- Thông báo UI sau khi lưu thành công dùng câu thân thiện, chẳng hạn **“Đã lưu thay đổi thành công!”**, không hiển thị tên công nghệ Firebase cho người dùng.
- Các trường sức khỏe trong Firestore không chứa mật khẩu. Tỷ lệ mỡ *ước tính* không được ghi đè thành số đo thực tế.

### Công thức tính chỉ số

Dành cho **người trưởng thành**, kết quả là ước tính, không thay thế đo lường hoặc tư vấn y tế:

- **BMI** = `weightKg / (heightCm / 100)^2`.
- **BMR** theo **Mifflin–St Jeor**: `10×kg + 6.25×cm − 5×tuổi + 5` (nam), hoặc `−161` (nữ).
- **TDEE** = `BMR × activityFactor`; mức hệ số có trong app gồm 1.2 (ít), 1.375 (nhẹ), 1.55 (vừa).
- **Tỷ lệ mỡ ước tính** theo **Deurenberg**: `1.2×BMI + 0.23×tuổi − 10.8×(nam=1, nữ=0) − 5.4`. Độ sai lệch ở từng cá nhân có thể lớn; không coi đây là số đo thực.
- Mức năng lượng mục tiêu hiện mặc định dựa trên TDEE duy trì, chưa cộng/trừ theo mục tiêu tăng/giảm cân. Calorie đã ăn và các thành phần tập luyện/dinh dưỡng khác còn có dữ liệu minh họa.

## 5. Firestore Rules & xử lý lỗi phổ biến

File `firestore.rules` là nguồn Rules ứng với bản source này. Rules yêu cầu UID người dùng khớp document và token `email_verified == true` trước khi đọc/ghi; đồng thời kiểm tra các trường hồ sơ cơ bản và các giới hạn giá trị. **Mọi lần thay đổi Rules đều cần Publish trong Console**.

| Triệu chứng | Kiểm tra |
|---|---|
| `permission-denied` khi nhấn Đăng ký | Đảm bảo đang dùng code **không ghi Firestore trước khi xác minh**; kiểm tra nguồn ZIP mới |
| `permission-denied` sau khi đã xác minh | Xem Rules đã Publish chưa, project ID có đúng không, token đã làm mới chưa |
| Email chưa xác minh nhưng bấm “đã xác minh” | Không bỏ qua được: lần đăng nhập vẫn kiểm tra `emailVerified` |
| `auth/email-already-in-use` | Tài khoản có thể đã được tạo ở lượt thử trước; kiểm tra Firebase Authentication |
| Không thấy `users/{uid}` | Chỉ tạo hồ sơ ở lần đăng nhập **đã xác minh**, không tạo lúc đăng ký |
| Lưu hồ sơ thất bại | Xem UID, giá trị hợp lệ, trạng thái email và lỗi Rules; không hiện thông báo thành công giả |
| Module `firebase/auth` không tìm thấy | `npm ls firebase`; nếu trống, chạy `npm install` thành công trước |
| Lỗi TypeScript `getReactNativePersistence` | Kiểm tra cách import và conditional exports của Firebase 12, `src/services/auth.ts`, cấu hình Metro; tránh tắt kiểm tra kiểu hàng loạt |

Nội dung `firestore.rules` trong project cần được quản lý nhất quán với các module mới. Hiện chưa có Rules và backend đầy đủ cho mọi tính năng ăn uống/tập luyện.

## 6. Các màn hình và dữ liệu mẫu Figma

## Xem đủ 100 màn hình

- Nhấn giữ **logo EcoFit hoặc một tiêu đề lớn** để mở danh mục 100 màn hình; có thể tìm theo số/tên.
- Trên Web, thêm `?screen=1` đến `?screen=100` vào địa chỉ ứng dụng để mở trực tiếp từng màn hình.
- Màn hình khởi đầu mặc định là số 6 — Splash. Các tab và nút điều hướng sử dụng đích từ prototype Figma.
- Nút Quay lại trên Android và nút quay lại trong giao diện đều có lịch sử điều hướng.

## Tương tác mẫu

- Giao diện tối là mặc định. Vào **Cá nhân → Tùy chỉnh ứng dụng → Giao diện** để chọn **Sáng / Tối**; lựa chọn được lưu trên thiết bị và áp dụng cho toàn bộ màn hình, hộp thoại, biểu mẫu và danh mục màn hình. Lựa chọn cũ được giữ lại nếu bạn đã chọn rõ ràng trước đó.
- Đăng ký/đăng nhập dùng Firebase Authentication; email cần xác minh thật trước khi vào ứng dụng. Luồng OTP 6 chữ số ban đầu của Figma không được dùng cho Firebase Email/Password.
- Ghi thêm 250 ml nước; thay đổi số lần tập; chạy/tạm dừng đồng hồ 30 giây; chọn thực phẩm và bật/tắt lời nhắc.
- Hồ sơ tài khoản và chỉ số cơ thể được lưu trong Cloud Firestore; các module ăn uống/tập luyện/nước và phần tương tác demo còn dùng state cục bộ/AsyncStorage. Không lưu mật khẩu trong Firestore.
- Nhấn giữ tiêu đề để mở danh mục, sau đó chọn **Đặt lại dữ liệu mẫu** để quay về trạng thái ban đầu.


## 7. Cấu trúc source & tài nguyên

| Đường dẫn | Nội dung |
|---|---|
| `App.tsx` | Điều hướng 100 màn hình, tích hợp đăng ký/đăng nhập, xác minh email, chỉnh sửa hồ sơ |
| `src/components/NativeScene.tsx` | Thành phần React Native để dựng bố cục, chữ, thẻ, nút và vùng cuộn |
| `src/components/DesignImage.tsx` | Hiển thị SVG theo bảng màu đang chọn, giữ kích thước và hình dạng gốc; ảnh PNG giữ nguyên |
| `src/design/screens.json` | Bố cục và nội dung của đủ 100 frame, kèm ID nguồn Figma |
| `src/design/overlays.json` | 37 hộp thoại/trạng thái phụ |
| `src/design/navigation.json` | Liên kết prototype theo ID lớp |
| `src/design/sceneState.ts` | Trạng thái chọn ban đầu theo dấu chọn trong thiết kế |
| `src/design/theme.tsx` | Theme provider, bảng màu và ánh xạ màu theo vai trò của nội dung |
| `src/design/theme-tokens.json` | Giá trị Light/Dark từ biến Spectrum trong Figma |
| `src/state/DemoStore.tsx` | Dữ liệu cục bộ và các tương tác chưa đồng bộ Firestore |
| `assets/figma/` | Ảnh và SVG gốc đã tải về |
| `assets/fonts/` | Manrope, Inter và giấy phép font |
| `src/services/firebase.ts` | Khởi tạo Firebase App và Firestore |
| `src/services/auth.ts` | Firebase Auth và lưu phiên trên native/web |
| `src/services/authService.ts` | Đăng ký, xác minh email, đăng nhập, đăng xuất, quản lý hồ sơ |
| `src/services/healthCalculations.ts` | Tính BMI/BMR/TDEE và tỷ lệ mỡ ước tính |
| `.env` / `.env.example` | Cấu hình Firebase phía client; thay giá trị theo project của bạn |
| `firestore.rules` | Rules cần **Publish thủ công** lên Firebase Console |

Giao diện dùng `View`, `Text`, `Pressable`, `TextInput`, `ScrollView` và SVG trong React Native. Ảnh chụp nguyên màn hình và WebView không được dùng để thay thế giao diện. Tài nguyên đã đóng gói cục bộ; không dùng URL Figma tạm thời khi chạy ứng dụng.

Màn hình Splash giữ chu kỳ chuyển động 4,8 giây từ Figma. Chuyển động được tắt khi thiết bị bật chế độ giảm chuyển động.

Tài nguyên gồm 498 tệp gốc và 2 biến thể SVG dành riêng cho animation; các tệp gốc được giữ nguyên. Mật khẩu được xử lý bởi Firebase Authentication; không lưu mật khẩu trong Firestore.

Chế độ tối dùng màu Foundation từ hành động prototype `202:3790` và biến Spectrum Light/Dark của Figma. SVG đổi màu hiển thị theo token; đường nét, kích thước và tệp gốc không đổi. Ảnh PNG, màu vàng thương hiệu và gradient hero được giữ nguyên. Không chỉnh sửa file Figma.



## 8. Kiểm tra trước khi bàn giao

```bash
npm run typecheck
npm run validate:design
npx expo export --platform all
```

Kiểm thử thủ công tối thiểu:

1. Đăng ký email mới → ứng dụng yêu cầu mở hộp thư; chưa xác minh thì đăng nhập bị từ chối.
2. Nhấn liên kết trong email → đăng nhập → `Authentication/Users` hiện đã xác minh → Firestore có `users/{uid}`.
3. Chỉnh giới tính/ngày sinh/chiều cao/cân nặng → lưu; tắt mở lại ứng dụng và kiểm tra dữ liệu đã được khôi phục.
4. Đổi tên tại Cá nhân → trở về Trang chủ thấy tên mới, lưu thành công.
5. Nhập chiều cao/cân nặng bằng bàn phím số; đơn vị `cm` và `kg` không xóa được.
6. Thử lỗi mạng/quyền để bảo đảm không báo “đã lưu” khi Firestore từ chối.
7. Kiểm tra hiệu ứng và bố cục trên màn hình thật; `npm run typecheck` không thay thế kiểm thử runtime.

Các phép kiểm thử trên thiết bị/Firebase thực tế phụ thuộc môi trường triển khai; README này mô tả **hành vi được thiết kế trong mã nguồn**, không khẳng định mọi ca kiểm thử đã đạt trên thiết bị của người dùng.

## 9. Tài liệu trước đây đã gộp

Các hướng dẫn `FIREBASE_SETUP.md`, `FIREBASE_AUTH_INTEGRATION.md`, `EMAIL_VERIFICATION_FLOW.md`, `FIREBASE_REGISTRATION_FIX.md`, `FIREBASE_PROFILE_GUIDE.md` và `FIXED_UNITS_NOTE.md` đã được tích hợp theo chủ đề trong README này. Khi chỉnh backend hoặc luồng UI mới, chỉ cần cập nhật một tài liệu.


## 9. Nhật ký ăn uống & uống nước (Firebase Firestore)

**Đã triển khai:** `src/services/nutritionService.ts`, `src/services/waterService.ts`; tích hợp tại `App.tsx`. Dữ liệu chỉ tải khi người dùng đăng nhập bằng tài khoản Firebase **đã xác minh email**.

### Database

- `users/{uid}/meal_logs/{autoId}`: `name`, `mealType` (`breakfast`, `lunch`, `dinner`, `snack`), `calories`, `proteinGrams`, `carbsGrams`, `fatGrams`, `dateKey`, `createdAt`. Có thể có `quantityGrams`.
- `users/{uid}/water_logs/{autoId}`: `amountMl`, `dateKey`, `createdAt`.
- `dateKey` được lập theo ngày **trên điện thoại** dưới dạng `YYYY-MM-DD`; `createdAt` là Firestore server timestamp. Tổng được tính ở client từ các bản ghi truy vấn cùng ngày, cập nhật realtime qua `onSnapshot`.
- Không tự tạo collection thủ công. Chúng xuất hiện sau lần đầu người dùng thêm bữa ăn/uống nước.

### Giao diện đã kết nối

- Màn hình **21 — Nhật ký bữa ăn**: nút **+ Thêm món ăn** mở form nhập tên món, loại bữa ăn, kcal, protein, carb, fat. Có nút **Xem tất cả bản ghi** và xóa từng món.
- Màn hình **24 — Kết quả nhận diện**: **Thêm vào nhật ký** ghi món mẫu *Cơm gà rau củ* theo thông số minh họa của Figma (480 kcal, P38, C57, F10). **Đây chưa phải chức năng AI nhận diện ảnh thật.**
- Màn hình **36 — Nước uống**: **+ Ghi 250 ml nước**, **+ Lượng khác**, danh sách và xóa từng lần.
- Màn hình **1 (Trang chủ)**, **21**, **34 (Macro)**, **35 (Năng lượng)** và **36**: hiển thị tổng theo Firestore của ngày hôm nay; không còn dùng 1.480 kcal hoặc 1,6 L làm mặc định. Mục tiêu calorie lấy từ hồ sơ/BMR/TDEE nếu đủ dữ liệu, nếu chưa thì dùng 2.000 kcal mặc định; chia mục tiêu macro tạm theo 25% protein / 50% carb / 25% fat.
- Tên món, kcal và các macro do **người dùng nhập thủ công**, cần dựa trên nhãn hoặc dữ liệu đáng tin cậy. Không có tự động nhận dạng thực phẩm hay xác minh độ chính xác dinh dưỡng.
- Danh sách trên màn hình 21 chỉ có 3 ô trong thiết kế gốc; mở **Xem tất cả bản ghi** để xem đầy đủ nhật ký trong ngày.

### Quan trọng: Deploy Security Rules

File `firestore.rules` đã được mở rộng để cho phép user sở hữu UID tương ứng, có `email_verified == true`, **đọc/thêm/xóa** bản ghi con. Rules kiểm tra loại dữ liệu và giá trị hợp lệ; **không cho update một bản ghi** trong phiên bản này (muốn sửa thì xóa và thêm lại).

**Cần Publish toàn bộ file `firestore.rules` mới** tại Firebase Console → Firestore Database → Rules → Publish. Nếu không, ứng dụng sẽ gặp `permission-denied` khi thêm nhật ký, dù Authentication và hồ sơ cá nhân vẫn hoạt động. Không chỉnh các quy tắc đăng ký/xác minh email cũ.

### Kiểm thử bắt buộc

1. Đăng nhập tài khoản đã xác minh; thêm một món, thêm 250 ml nước; kiểm tra hai collection trong Firestore và số tổng trên các màn hình.
2. Đóng/mở lại Expo Go: dữ liệu vẫn có vì nằm trong Firestore.
3. Xóa một bản ghi: Firestore và số tổng cập nhật; ngày khác không bị ảnh hưởng.
4. Đăng xuất → đăng nhập tài khoản khác: không nhìn thấy nhật ký của tài khoản cũ.
5. Kiểm tra không có món ăn nào: calorie bằng 0, nước bằng 0 (không còn số demo).

Lưu ý giai đoạn hiện tại: lịch sử 7 ngày, biểu đồ tiến độ, kho thực phẩm và gợi ý AI chưa được đồng bộ hoàn chỉnh. Kiểm tra mạng và Firestore Rules nếu không hiển thị dữ liệu; UI sẽ báo lỗi tải nhật ký khi listener gặp sự cố.


## Múi giờ của nhật ký ăn uống và uống nước (Việt Nam)

- `src/services/vietnamDate.ts` là nguồn tính ngày chung cho cả hai nhật ký, cố định `Asia/Ho_Chi_Minh` (UTC+07:00), không phụ thuộc múi giờ thiết bị.
- Mỗi lần lưu món ăn hoặc uống nước, `dateKey` dùng định dạng `YYYY-MM-DD` theo ngày Việt Nam; `createdAt` vẫn dùng Firestore server timestamp cho thời điểm thực.
- Trang chủ và các tổng hợp trong ngày đăng ký listener Firestore theo `dateKey`. App kiểm tra đổi ngày khi được mở lại và mỗi phút trong lúc chạy.
- Nhãn ngày của nhật ký ăn uống hiển thị theo ngày Việt Nam.
- Các bản ghi **đã lưu trước khi đổi múi giờ** không được tự chỉnh sửa để tránh làm thay đổi dữ liệu lịch sử; nếu tạo khi thiết bị không đặt giờ VN, `dateKey` cũ có thể thuộc ngày khác.
- Sau khi cập nhật, hãy khởi động lại Metro (`npx expo start -c`) và thử tạo bản ghi gần thời điểm giao ngày nếu cần. Không cần đổi Firestore Rules cho cập nhật này.


## Xem chi tiết bữa ăn đã lưu

- Từ **Ăn uống → Nhật ký dinh dưỡng hôm nay**, chạm thẻ bữa ăn có dữ liệu, hoặc mở **Mở nhật ký hôm nay** rồi chạm tên món.
- Màn hình chi tiết đọc món đã chọn từ nhật ký Firestore của tài khoản, hiển thị đúng **tên món, loại bữa, kcal, protein, carb và fat**.
- **Xem thành phần** hiển thị lại các chỉ số dinh dưỡng đã ghi. Form hiện tại **chưa thu thập nguyên liệu**, nên app không tự tạo danh sách nguyên liệu. Hình minh họa món ăn vẫn là ảnh mẫu Figma.
- Nút lưu trên màn hình chi tiết không thêm trùng một món đã tồn tại. Để xóa, chọn **Mở nhật ký hôm nay → Xóa** tại món tương ứng.
- Các thẻ trống không mở trang món ăn mẫu nữa.


## Xem lại nhật ký theo ngày (múi giờ Việt Nam)

- Trong **Ăn uống**, chọn **Xem nhật ký theo ngày**; trong **Nước uống**, chọn **Xem lịch sử uống nước**.
- Cửa sổ lịch sử có 7 ngày gần nhất, nút ngày trước/ngày sau để đi xa hơn, và **Về hôm nay**. Dữ liệu của ngày được chọn được đọc theo `dateKey` (`YYYY-MM-DD`) ở múi giờ `Asia/Ho_Chi_Minh`.
- Tổng calorie/nước ở Trang chủ **chỉ tính hôm nay**, không cộng dồn bản ghi cũ. Dữ liệu cũ vẫn có trong Firestore và không bị xóa lúc sang ngày.
- Trong lịch sử, có thể mở đúng món ăn đã lưu và xóa từng bản ghi. Khi xóa bản ghi quá khứ, chỉ ngày đó được cập nhật; khi xóa hôm nay, thống kê Trang chủ tự cập nhật qua listener.
- Cấu trúc dữ liệu và Firestore Rules không thay đổi. Không cần Publish Rules lại chỉ vì bổ sung nút chọn ngày.
- Test: chọn ngày hôm qua có dữ liệu, kiểm tra tổng; chọn hôm nay để thấy tổng mới; đăng xuất/đăng nhập lại và xác nhận lịch sử vẫn còn.
