# IB PYP Quest Pad · 学习打卡台 🌟

[English](#english) | [中文说明](#中文说明)

---

<a name="english"></a>
## English

**IB PYP Quest Pad** is an interactive, inquiry-based learning workbench, habit tracker, and celebration system designed for IB PYP (Primary Years Programme) students, young learners, and their families. It turns daily routines, reading journeys, and self-directed inquiries into motivating, step-by-step quests.

### 🚀 Live Demo & Instant Access

You can directly experience and use the app online:

👉 **[https://ib-pyp.ai.studio/](https://ib-pyp.ai.studio/)**

- **Zero-Setup Quickstart**: Sign in with any Google Account to immediately create your private workbench.
- **Multi-Device Cloud Sync**: Your tasks, progress, point ledger, and rewards automatically sync across iPad, tablet, phone, and computer in real-time.
- **Offline Capable**: Work offline anytime; changes seamlessly sync when reconnected.

---

### ✨ Key Features

1. **Structured Inquiry & Daily Quests**
   - **Multi-Category Architecture**: Organize tasks into customizable categories (e.g., Study 🌟, Habits 🌿, Reading 📖, Creativity 🎨, Life Skills ❤️).
   - **Multi-Month & Day-of-Week Targeting**: Assign quests to specific months with an interactive 12-month multi-select grid, year navigator, "All Year" / "This Month" shortcuts, and weekday schedules.
   - **Ordered Sub-Steps & Built-In Focus Timer**: Break down complex inquiries into sequential steps with dedicated focus timers, animated progress rings, and step completion toggles.

2. **Milestone Goals & Visual Progress**
   - Associate daily quests with **Associated Big Goals** (e.g., "Read 30 Books this Term").
   - Track progress toward big milestones with visual counter bars and goal completion badges.

3. **Isolated Points Ledger & Reward Wishlist**
   - **Independent Category Ledgers**: Points earned in specific disciplines (e.g., Reading vs. Sports) remain transparent and uninflated.
   - **Wishlist & Redemptions**: Parents can configure meaningful rewards with category point costs, tier ratings, and period limits (e.g., once a week or month).
   - Full ledger audit history tracking all earned, spent, and adjusted points.

4. **Protected Parent Hub (PIN Protected)**
   - Protect parental controls with a 4-digit PIN (Default: `1234`, customizable in settings).
   - Add, edit, reorder, or pause quests and sub-steps.
   - Manage categories, point names, and emojis.
   - Manual point adjustments with explanatory reason logs.
   - **Complete Data Portability**: Export and import complete workbench backups as human-readable JSON files.

5. **Audio-Visual Celebrations**
   - Built-in Web Audio API synthesized audio fanfares on step done and quest accomplishments (no external audio assets required).
   - Confetti bursts and encouraging bilingual growth-mindset messages.

6. **Bilingual & Responsive**
   - Full English and Simplified Chinese (`中文`) localization with one-click toggling.
   - Tactile, playful notebook aesthetics optimized for iPad, touch screens, and desktop viewports.

---

### 🛠️ Self-Hosting & Deployment

You can easily deploy your own instance of IB PYP Quest Pad using Node.js and Firebase.

#### Prerequisites
- Node.js (v18 or higher)
- A Firebase project with **Firebase Authentication** (Google Sign-In Provider enabled) and **Cloud Firestore**.

#### 1. Clone the repository
```bash
git clone https://github.com/your-username/ib-pyp-quest-pad.git
cd ib-pyp-quest-pad
```

#### 2. Install dependencies
```bash
npm install
```

#### 3. Configure Firebase
Place your Firebase web configuration in `firebase-applet-config.json` at the project root:
```json
{
  "projectId": "your-firebase-project-id",
  "appId": "your-app-id",
  "apiKey": "your-api-key",
  "authDomain": "your-firebase-project-id.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "your-firebase-project-id.firebasestorage.app",
  "messagingSenderId": "your-sender-id"
}
```

#### 4. Configure Firestore Security Rules
Deploy the following security rules in your Firebase Console or via Firebase CLI:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /workbenches/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

#### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### 6. Build for Production
```bash
npm run build
```
The static production assets will be output to the `dist/` directory, ready to deploy to Firebase Hosting, Cloudflare Pages, Vercel, or any static hosting service.

---

<a name="中文说明"></a>
## 中文说明

**IB PYP Quest Pad（学习打卡台）** 是一款专为 IB PYP（小学项目）学生、儿童及家庭设计的探究学习工作台、习惯养成与正向激励系统。它将每日学习任务、阅读挑战和自主探究拆解为生动有趣、按部就班的通关任务（Quests）。

### 🚀 在线体验与即刻使用

无需繁琐配置，你可以直接访问官方在线平台：

👉 **[https://ib-pyp.ai.studio/](https://ib-pyp.ai.studio/)**

- **即开即用**：使用任意 Google 账号登录即可自动创建独立的专属学习工作台。
- **多端云同步**：实时在 iPad、平板、手机与电脑之间自动双向同步任务打卡进度、积分账本与心愿单。
- **离线支持**：支持断网离线操作，网络恢复后自动同步至云端。

---

### ✨ 核心功能亮点

1. **结构化探究任务（Quests）**
   - **多维度学科与习惯分类**：任务支持归类至学习探究 🌟、生活习惯 🌿、自主阅读 📖、创意实践 🎨、身心健康 ❤️ 等自定义分类。
   - **多月份与周计划智能排程**：支持按年切换的 12 个月份多选面板、提供「全年」与「仅当月」一键选择，灵活设定星期重复周期。
   - **有序子步骤与专注倒计时**：每个任务均可拆分为多个有序步骤，内置专注计时器、环形进度动画和步骤打卡。

2. **长期大目标（Big Goals）追踪**
   - 可将每日日常任务与长期大目标（如「本学期完成30本英文读物」）关联。
   - 随日常打卡自动累计达成次数，直观呈现进度条与成就标识。

3. **独立积分账本与心愿兑换（Rewards）**
   - **分类积分隔离**：各维度的积分独立累计与消耗，杜绝不同类别的积分通胀。
   - **心愿奖励兑换**：家长可自定义心愿奖励、所需积分分类、星级难度及周期兑换上限（如每周/每月限兑 1 次）。
   - **透明审计账本**：完整记录每一笔奖励获得、心愿兑换与手动调整的流水记录。

4. **家长管理后台（PIN 码保护）**
   - 配备 4 位密码锁保护（默认密码：`1234`，可在后台随时修改）。
   - 支持创建、编辑、暂停任务，自定义步骤时长与上下排序。
   - 分类名称、代币名称与 Emoji 自定义配置。
   - 积分手动补发/扣减功能（附带调整原因备注）。
   - **完整数据备份与恢复**：一键导出/导入标准化 JSON 备份文件，数据完全归用户所有。

5. **视听盛宴与成长型反馈**
   - 基于原生 Web Audio API 合成仪式感完成音效与通关号角，无需加载任何外部音频文件。
   - 炫彩彩带（Confetti）动效与双语成长型思维鼓励金句。

6. **双语界面与触屏优化**
   - 支持中文（简体）与英文一键无缝即时切换。
   - 采用触感细腻、对比清晰的实体手帐风格设计，完美适配 iPad、触屏平板与桌面显示屏。

---

### 🛠️ 自主部署指南

#### 前置要求
- Node.js (v18 或更高版本)
- 一个开启了 **Google 登录** 和 **Cloud Firestore** 的 Firebase 项目。

#### 1. 克隆代码仓库
```bash
git clone https://github.com/your-username/ib-pyp-quest-pad.git
cd ib-pyp-quest-pad
```

#### 2. 安装项目依赖
```bash
npm install
```

#### 3. 配置 Firebase
在项目根目录下创建或编辑 `firebase-applet-config.json`：
```json
{
  "projectId": "your-firebase-project-id",
  "appId": "your-app-id",
  "apiKey": "your-api-key",
  "authDomain": "your-firebase-project-id.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "your-firebase-project-id.firebasestorage.app",
  "messagingSenderId": "your-sender-id"
}
```

#### 4. 配置 Firestore 安全规则
在 Firebase 控制台的 Firestore Rules 中发布以下安全策略：
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /workbenches/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

#### 5. 启动本地开发服务
```bash
npm run dev
```
在浏览器中打开 [http://localhost:3000](http://localhost:3000) 即可开始使用。

#### 6. 构建生产版本
```bash
npm run build
```
编译产物将生成在 `dist/` 文件夹中，可直接部署至 Firebase Hosting、Cloudflare Pages、Vercel 等任意静态托管平台。

---

## 📄 License

This project is open-sourced under the [MIT License](./LICENSE).

本项目采用 [MIT 许可证](./LICENSE) 开源。
