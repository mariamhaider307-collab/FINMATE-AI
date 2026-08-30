/* ============================================================
   FinMate AI — app.js
   Core logic: state, API calls, rendering
   ============================================================ */

// ──────────────────────────────────────────────
// 1. API CONFIGURATION
//    Points to the backend. Change this when deploying.
// ──────────────────────────────────────────────

const API_BASE = "http://localhost:8001";
// When deploying, change to: "https://finmate-ai-backend.onrender.com"

// ──────────────────────────────────────────────
// 1b. CURRENCY DATA
//     Each currency has a code and display symbol.
// ──────────────────────────────────────────────

const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British Pound" },
  PKR: { symbol: "Rs.", name: "Pakistani Rupee" },
  INR: { symbol: "₹", name: "Indian Rupee" },
  AED: { symbol: "د.إ", name: "UAE Dirham" },
  SAR: { symbol: "﷼", name: "Saudi Riyal" },
  CNY: { symbol: "¥", name: "Chinese Yuan" },
  JPY: { symbol: "¥", name: "Japanese Yen" },
  KRW: { symbol: "₩", name: "South Korean Won" },
  TRY: { symbol: "₺", name: "Turkish Lira" },
  AUD: { symbol: "A$", name: "Australian Dollar" },
  CAD: { symbol: "C$", name: "Canadian Dollar" },
  CHF: { symbol: "Fr", name: "Swiss Franc" },
  SGD: { symbol: "S$", name: "Singapore Dollar" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit" },
  IDR: { symbol: "Rp", name: "Indonesian Rupiah" },
  THB: { symbol: "฿", name: "Thai Baht" },
  PHP: { symbol: "₱", name: "Philippine Peso" },
  BRL: { symbol: "R$", name: "Brazilian Real" },
  ZAR: { symbol: "R", name: "South African Rand" },
  MXN: { symbol: "Mex$", name: "Mexican Peso" },
  NGN: { symbol: "₦", name: "Nigerian Naira" },
  EGP: { symbol: "E£", name: "Egyptian Pound" },
  BDT: { symbol: "৳", name: "Bangladeshi Taka" },
};

// ──────────────────────────────────────────────
// 2. STATE
//    The single source of truth for the app.
//    Loaded from the backend API, not localStorage.
// ──────────────────────────────────────────────

let state = { income: 0, expenses: [], currency: "USD" };

/** Fetch all data from the backend and update state. */
async function fetchAllData() {
  try {
    // Fetch income and expenses in parallel
    const [incomeRes, expensesRes] = await Promise.all([
      fetch(API_BASE + "/api/income"),
      fetch(API_BASE + "/api/expenses"),
    ]);

    const incomeData   = await incomeRes.json();
    const expensesData = await expensesRes.json();

    state.income = incomeData.income;

    // Map backend snake_case (created_at) to frontend camelCase (createdAt)
    state.expenses = expensesData.expenses.map((exp) => ({
      id: exp.id,
      name: exp.name,
      amount: exp.amount,
      category: exp.category,
      createdAt: exp.created_at,
    }));

    render();
  } catch (err) {
    console.error("Could not connect to the backend API.", err);
    showError("Cannot connect to the server. Please try again later.");
  }
}

// ──────────────────────────────────────────────
// 3. DOM REFERENCES
//    Grab all the elements we need once, up front.
// ──────────────────────────────────────────────

const dom = {
  // Summary cards
  totalIncome:    document.getElementById("total-income"),
  totalExpenses:  document.getElementById("total-expenses"),
  balance:        document.getElementById("remaining-balance"),
  balanceCard:    document.querySelector(".card-balance"),

  // Income form
  incomeForm:  document.getElementById("income-form"),
  incomeInput: document.getElementById("income-input"),

  // Expense form
  expenseForm:     document.getElementById("expense-form"),
  expenseName:     document.getElementById("expense-name"),
  expenseAmount:   document.getElementById("expense-amount"),
  expenseCategory: document.getElementById("expense-category"),

  // Lists / containers
  expenseList:        document.getElementById("expense-list"),
  breakdownContainer: document.getElementById("breakdown-container"),

  // AI Budget Analysis
  aiAnalyzeBtn: document.getElementById("ai-analyze-btn"),
  aiResults:     document.getElementById("ai-results"),

  // Currency
  currencySelect: document.getElementById("currency-select"),
  currencyPrefix: document.getElementById("currency-prefix"),

  // Chat
  chatToggleBtn:  document.getElementById("chat-toggle-btn"),
  chatPanel:      document.getElementById("chat-panel"),
  chatMessages:   document.getElementById("chat-messages"),
  chatPrompts:    document.getElementById("chat-prompts"),
  chatInputForm:  document.getElementById("chat-input-form"),
  chatInput:      document.getElementById("chat-input"),
  chatSendBtn:    document.getElementById("chat-send-btn"),
  chatClearBtn:   document.getElementById("chat-clear-btn"),
  chatCloseBtn:   document.getElementById("chat-close-btn"),
};

// ──────────────────────────────────────────────
// 4. HELPERS
// ──────────────────────────────────────────────

/** Format a number using the currently selected currency. */
function formatCurrency(amount) {
  const symbol = CURRENCIES[state.currency]?.symbol || "$";
  const formatted = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return symbol + " " + formatted;
}

/** Format a number with a specific currency code (for chatbot context). */
function fmtCurr(amount, currencyCode) {
  const symbol = CURRENCIES[currencyCode]?.symbol || "$";
  const formatted = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return symbol + " " + formatted;
}

/** Calculate total expenses from the expenses array. */
function calcTotalExpenses() {
  return state.expenses.reduce((sum, exp) => sum + exp.amount, 0);
}

/** Group expenses by category and return sorted array. */
function calcBreakdown() {
  const totals = {};
  state.expenses.forEach((exp) => {
    totals[exp.category] = (totals[exp.category] || 0) + exp.amount;
  });

  const total = calcTotalExpenses();

  // Convert object to array and sort descending by amount
  return Object.entries(totals)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Show a temporary error message to the user. */
function showError(message) {
  alert(message);
}

// ──────────────────────────────────────────────
// 5. RENDER
//    Re-draws every dynamic part of the page.
//    Called once on load and after every state change.
// ──────────────────────────────────────────────

function render() {
  const totalExp  = calcTotalExpenses();
  const balance   = state.income - totalExp;

  // ── Currency UI sync ───────────────────────
  const symbol = CURRENCIES[state.currency]?.symbol || "$";
  if (dom.currencyPrefix) dom.currencyPrefix.textContent = symbol;
  if (dom.currencySelect) dom.currencySelect.value = state.currency;

  // ── Summary cards ──────────────────────────
  dom.totalIncome.textContent   = formatCurrency(state.income);
  dom.totalExpenses.textContent = formatCurrency(totalExp);
  dom.balance.textContent       = formatCurrency(balance);

  // Flip balance card to red when negative
  if (balance < 0) {
    dom.balanceCard.classList.add("negative");
  } else {
    dom.balanceCard.classList.remove("negative");
  }

  // ── Income input ───────────────────────────
  // Pre-fill the input with current income value
  if (state.income > 0 && dom.incomeInput.value === "") {
    dom.incomeInput.value = state.income;
  }

  // ── Expense list ───────────────────────────
  renderExpenseList();

  // ── Breakdown ──────────────────────────────
  renderBreakdown();
}

/** Build the expense list HTML. */
function renderExpenseList() {
  if (state.expenses.length === 0) {
    dom.expenseList.innerHTML =
      '<p class="empty-state">No expenses yet. Add your first expense above!</p>';
    return;
  }

  // Sort by date added (newest first)
  const sorted = [...state.expenses].sort((a, b) => b.createdAt - a.createdAt);

  dom.expenseList.innerHTML = sorted
    .map(
      (exp) => `
        <div class="expense-item" data-id="${exp.id}">
          <div class="expense-info">
            <div class="expense-name">${escapeHtml(exp.name)}</div>
            <div class="expense-category">${escapeHtml(exp.category)}</div>
          </div>
          <span class="expense-amount">${formatCurrency(exp.amount)}</span>
          <button
            class="btn btn-danger delete-btn"
            data-id="${exp.id}"
            aria-label="Delete ${escapeHtml(exp.name)}"
          >
            Delete
          </button>
        </div>
      `
    )
    .join("");
}

/** Build the spending breakdown bars. */
function renderBreakdown() {
  const breakdown = calcBreakdown();

  if (breakdown.length === 0) {
    dom.breakdownContainer.innerHTML =
      '<p class="empty-state">Add expenses to see your spending breakdown.</p>';
    return;
  }

  dom.breakdownContainer.innerHTML = breakdown
    .map(
      (item, index) => `
        <div class="breakdown-row">
          <span class="breakdown-label">${escapeHtml(item.category)}</span>
          <div class="breakdown-bar-track">
            <div
              class="breakdown-bar-fill bar-color-${index % 10}"
              style="width: ${item.percent.toFixed(1)}%;"
            ></div>
          </div>
          <span class="breakdown-amount">${formatCurrency(item.amount)}</span>
          <span class="breakdown-percent">${item.percent.toFixed(1)}%</span>
        </div>
      `
    )
    .join("");
}

/** Escape HTML to prevent XSS from user input. */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ──────────────────────────────────────────────
// 5b. AI BUDGET ANALYZER
//     This module generates personalized budget insights.
//
//     CURRENT: Rule-based analysis using local data.
//     FUTURE:  Replace the `analyze()` body with a fetch()
//              call to an AI API (OpenAI, Gemini, etc.).
//              The rest of the app stays unchanged.
// ──────────────────────────────────────────────

const aiAnalyzer = {

  /**
   * Analyze the user's budget and return structured insights.
   *
   * @returns {{ summary: string, suggestions: Array<{icon: string, text: string}> }}
   *
   * To connect a real AI API, replace this function body with:
   *   const res = await fetch(API_BASE + "/api/ai-analysis", {
   *     method: "POST",
   *     headers: { "Content-Type": "application/json" },
   *     body: JSON.stringify({ income: state.income, expenses: state.expenses }),
   *   });
   *   return await res.json();
   */
  analyze() {
    const income       = state.income;
    const totalExp     = calcTotalExpenses();
    const remaining    = income - totalExp;
    const breakdown    = calcBreakdown();
    const suggestions  = [];

    // ── Not enough data ──────────────────────
    if (income === 0 && state.expenses.length === 0) {
      return {
        summary: "Set your monthly income and add some expenses so I can analyze your budget.",
        suggestions: [],
      };
    }

    if (income === 0) {
      return {
        summary: "You've added expenses but haven't set your income yet. Set your monthly income to get personalized insights.",
        suggestions: [],
      };
    }

    // ── Build summary ────────────────────────
    const expPercent = ((totalExp / income) * 100).toFixed(0);
    const remainingPercent = ((remaining / income) * 100).toFixed(0);

    let summary = "";

    if (remaining < 0) {
      // Over budget
      summary =
        `<span class="ai-warning">Your expenses exceed your income by ${formatCurrency(Math.abs(remaining))}.</span> ` +
        `You're spending ${expPercent}% of your ${formatCurrency(income)} income. ` +
        `Let's look at where the money is going.`;
    } else if (remaining === 0) {
      summary =
        `You've allocated <span class="ai-highlight">100%</span> of your ${formatCurrency(income)} income. ` +
        `That means there's no room for unexpected costs. Let's find some flexibility.`;
    } else {
      summary =
        `Based on your budget, you have <span class="ai-highlight">${formatCurrency(remaining)} remaining</span> ` +
        `after your planned expenses (${remainingPercent}% of your ${formatCurrency(income)} income).`;
    }

    // ── Suggestion: Over budget warning ──────
    if (remaining < 0) {
      const largest = breakdown[0];
      suggestions.push({
        icon: "\u26A0\uFE0F",
        text: `You're over budget. Your biggest spending category is <strong>${escapeHtml(largest.category)}</strong> ` +
              `at <strong>${formatCurrency(largest.amount)}</strong> ` +
              `(${largest.percent.toFixed(0)}% of expenses). ` +
              `Look for ways to reduce this area first.`,
      });
    }

    // ── Suggestion: Largest category is dominant ──
    if (breakdown.length > 0) {
      const largest = breakdown[0];
      const incomeRatio = (largest.amount / income) * 100;

      if (incomeRatio > 40 && remaining >= 0) {
        suggestions.push({
          icon: "\uD83D\uDCC8",
          text: `<strong>${escapeHtml(largest.category)}</strong> takes up <strong>${incomeRatio.toFixed(0)}%</strong> ` +
                `of your income (${formatCurrency(largest.amount)}). ` +
                `Financial experts suggest keeping any single category below 30% when possible.`,
        });
      } else if (breakdown.length >= 2 && remaining >= 0) {
        suggestions.push({
          icon: "\uD83D\uDCCA",
          text: `Your top spending category is <strong>${escapeHtml(largest.category)}</strong> ` +
                `at <strong>${formatCurrency(largest.amount)}</strong> (${largest.percent.toFixed(0)}% of expenses), ` +
                `followed by <strong>${escapeHtml(breakdown[1].category)}</strong> ` +
                `at <strong>${formatCurrency(breakdown[1].amount)}</strong>.`,
        });
      }
    }

    // ── Suggestion: Allocate remaining money ─
    if (remaining > 0) {
      const savingsTarget    = Math.round(remaining * 0.6);
      const flexibleSpending = remaining - savingsTarget;

      suggestions.push({
        icon: "\uD83D\uDCA1",
        text: `You could consider setting aside <strong>${formatCurrency(savingsTarget)}</strong> for savings ` +
              `(60% of your remaining balance) and keeping <strong>${formatCurrency(flexibleSpending)}</strong> ` +
              `as flexible spending for things that come up unexpectedly.`,
      });
    }

    // ── Suggestion: No savings category ──────
    const hasSavings = breakdown.some((item) => item.category === "Savings");

    if (!hasSavings && income > 0 && remaining > 0) {
      const tenPercent = Math.round(income * 0.1);
      suggestions.push({
        icon: "\uD83D\uDCB0",
        text: `You don't have a savings category yet. Even setting aside <strong>${formatCurrency(tenPercent)}</strong> ` +
              `(10% of your income) each month can build a strong financial cushion over time.`,
      });
    }

    // ── Suggestion: Entertainment/Shopping high ─
    const discretionary = breakdown.filter(
      (item) => item.category === "Entertainment" || item.category === "Shopping"
    );
    const discretionaryTotal = discretionary.reduce((sum, item) => sum + item.amount, 0);
    const discretionaryPercent = income > 0 ? (discretionaryTotal / income) * 100 : 0;

    if (discretionaryPercent > 20) {
      suggestions.push({
        icon: "\uD83C\uDFAD",
        text: `Entertainment and Shopping together make up <strong>${discretionaryPercent.toFixed(0)}%</strong> ` +
              `of your income (<strong>${formatCurrency(discretionaryTotal)}</strong>). ` +
              `Consider setting a monthly cap for these categories to free up more for savings.`,
      });
    }

    // ── Suggestion: Budget is healthy ────────
    if (remaining >= 0 && remainingPercent >= 20 && suggestions.length <= 2) {
      suggestions.push({
        icon: "\u2705",
        text: `Your budget looks healthy! You're using <strong>${expPercent}%</strong> of your income ` +
              `for planned expenses and keeping <strong>${remainingPercent}%</strong> unallocated. ` +
              `Keep tracking your spending to stay on course.`,
      });
    }

    return { summary, suggestions };
  },
};

/** Render the AI analysis results. */
function renderAIAnalysis() {
  const { summary, suggestions } = aiAnalyzer.analyze();

  // If no meaningful analysis yet, show the default prompt
  if (!summary && suggestions.length === 0) {
    dom.aiResults.innerHTML =
      '<p class="empty-state">Set your income and add some expenses, then click the button above for personalized budget insights.</p>';
    return;
  }

  let html = "";

  // Summary box
  html += `<div class="ai-summary-box"><p>${summary}</p></div>`;

  // Suggestions list
  if (suggestions.length > 0) {
    html += '<div class="ai-suggestions">';
    suggestions.forEach((s) => {
      html += `
        <div class="ai-suggestion">
          <span class="ai-suggestion-icon">${s.icon}</span>
          <span class="ai-suggestion-text">${s.text}</span>
        </div>`;
    });
    html += "</div>";
  }

  dom.aiResults.innerHTML = html;
}

/** Handle the Analyze button click with a loading animation. */
async function handleAIAnalyze() {
  // Disable button and show loading
  dom.aiAnalyzeBtn.disabled = true;
  dom.aiResults.innerHTML =
    '<div class="ai-loading"><div class="ai-spinner"></div> Analyzing your budget...</div>';

  // Small delay to show the loading state (feels more natural)
  await new Promise((resolve) => setTimeout(resolve, 600));

  renderAIAnalysis();

  // Re-enable button
  dom.aiAnalyzeBtn.disabled = false;
}

// ──────────────────────────────────────────────
// 5c. CURRENCY CHANGE HANDLER
// ──────────────────────────────────────────────

function handleCurrencyChange(event) {
  const newCurrency = event.target.value;
  if (CURRENCIES[newCurrency]) {
    state.currency = newCurrency;
    // Save to localStorage so it persists across refreshes
    try { localStorage.setItem("finmate_currency", newCurrency); } catch (e) { /* ignore */ }
    render();
  }
}

// ──────────────────────────────────────────────
// 5d. CHAT SYSTEM
//     Manages the chat UI, message state, and
//     communication with the chatbot engine.
// ──────────────────────────────────────────────

const chat = {
  messages: [],      // { role: "user"|"assistant", text: string }
  isOpen: false,
  isTyping: false,
};

/** Toggle the chat panel open/closed. */
function toggleChat() {
  chat.isOpen = !chat.isOpen;
  dom.chatPanel.hidden = !chat.isOpen;
  dom.chatToggleBtn.style.display = chat.isOpen ? "none" : "flex";

  if (chat.isOpen) {
    // Show welcome message if first open
    if (chat.messages.length === 0) {
      addAssistantMessage(getGreetingMessage());
    }
    renderChatMessages();
    dom.chatInput.focus();
  }
}

/** Close the chat panel. */
function closeChat() {
  chat.isOpen = false;
  dom.chatPanel.hidden = true;
  dom.chatToggleBtn.style.display = "flex";
}

/** Add a user message to chat history. */
function addUserMessage(text) {
  chat.messages.push({ role: "user", text });
}

/** Add an assistant message to chat history. */
function addAssistantMessage(text) {
  chat.messages.push({ role: "assistant", text });
}

/** Render all chat messages to the DOM. */
function renderChatMessages() {
  if (chat.messages.length === 0) {
    dom.chatMessages.innerHTML = "";
    return;
  }

  // Hide prompts once conversation starts
  if (chat.messages.length > 1) {
    dom.chatPrompts.hidden = true;
  }

  let html = "";
  chat.messages.forEach((msg) => {
    html += `<div class="chat-msg ${msg.role}">
      <div class="chat-msg-bubble">${msg.text}</div>
    </div>`;
  });

  // Typing indicator
  if (chat.isTyping) {
    html += `<div class="chat-msg assistant">
      <div class="chat-typing">
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
      </div>
    </div>`;
  }

  dom.chatMessages.innerHTML = html;

  // Auto-scroll to bottom
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

/** Handle sending a chat message. */
async function handleChatSend(event) {
  event.preventDefault();

  const text = dom.chatInput.value.trim();
  if (!text || chat.isTyping) return;

  // Add user message
  addUserMessage(escapeHtml(text));
  dom.chatInput.value = "";
  dom.chatPrompts.hidden = true;

  // Show typing indicator
  chat.isTyping = true;
  renderChatMessages();

  // Generate response (with a small delay for natural feel)
  await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 600));

  try {
    const response = chatbotEngine.generateResponse(text);
    chat.isTyping = false;
    addAssistantMessage(response);
    renderChatMessages();
  } catch (err) {
    chat.isTyping = false;
    addAssistantMessage(
      `<div class="chat-error">Sorry, something went wrong. Please try again.</div>`
    );
    renderChatMessages();
    console.error("Chat error:", err);
  }
}

/** Handle clicking a suggested prompt chip. */
function handlePromptClick(event) {
  const chip = event.target.closest(".chat-prompt-chip");
  if (!chip) return;
  const prompt = chip.dataset.prompt;
  dom.chatInput.value = prompt;
  handleChatSend(new Event("submit"));
}

/** Clear the chat history. */
function clearChat() {
  chat.messages = [];
  dom.chatPrompts.hidden = false;
  renderChatMessages();
}

/** Handle Enter key in chat input. */
function handleChatKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleChatSend(event);
  }
}

// ──────────────────────────────────────────────
// 5e. CHATBOT ENGINE
//     Rule-based response generator that uses the
//     user's budget data to give contextual answers.
//
//     CURRENT: Pattern matching + template responses.
//     FUTURE:  Replace generateResponse() body with
//              a fetch() to an AI API endpoint.
//              Pass getBudgetContext() as the prompt context.
// ──────────────────────────────────────────────

/** Build a context summary of the user's current budget for the chatbot. */
function getBudgetContext() {
  const income    = state.income;
  const totalExp  = calcTotalExpenses();
  const remaining = income - totalExp;
  const breakdown = calcBreakdown();
  const curr      = state.currency;
  const symbol    = CURRENCIES[curr]?.symbol || "$";

  return {
    currency: curr,
    symbol,
    income,
    totalExpenses: totalExp,
    remaining,
    breakdown,
    hasData: income > 0 || state.expenses.length > 0,
    hasIncome: income > 0,
    hasExpenses: state.expenses.length > 0,
    isOverBudget: remaining < 0,
  };
}

/** Get the initial greeting message. */
function getGreetingMessage() {
  const ctx = getBudgetContext();
  if (ctx.hasData) {
    return `Hi! I'm <strong>FinMate AI</strong>, your budgeting assistant. ` +
      `I can see you have some budget data entered. Ask me anything about your spending, ` +
      `or pick a suggestion below to get started!`;
  }
  return `Hi! I'm <strong>FinMate AI</strong>, your budgeting assistant. ` +
    `I can help you create a budget, understand your spending, and learn about personal finance. ` +
    `Start by setting your income and adding some expenses, or just ask me a question!`;
}

/** The chatbot engine — generates responses based on pattern matching. */
const chatbotEngine = {

  /**
   * Generate a response to the user's message.
   *
   * CURRENT: Rule-based pattern matching.
   * FUTURE: Replace this function body with:
   *   const res = await fetch(API_BASE + "/api/chat", {
   *     method: "POST",
   *     headers: { "Content-Type": "application/json" },
   *     body: JSON.stringify({
   *       message: userMessage,
   *       history: chat.messages,
   *       context: getBudgetContext(),
   *     }),
   *   });
   *   const data = await res.json();
   *   return data.reply;
   */
  generateResponse(userMessage) {
    const msg = userMessage.toLowerCase().trim();
    const ctx = getBudgetContext();
    const sym = ctx.symbol;
    const curr = ctx.currency;

    // ── Helpers ──────────────────────────
    const fmt = (n) => fmtCurr(n, curr);

    // ── Greetings ────────────────────────
    if (/^(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening))\b/.test(msg)) {
      if (ctx.hasData) {
        return `Hello! 👋 I can see your current budget. ` +
          `Your income is <strong>${fmt(ctx.income)}</strong> and you've spent <strong>${fmt(ctx.totalExpenses)}</strong>. ` +
          `What would you like to know?`;
      }
      return `Hello! 👋 I'm here to help with budgeting and personal finance. ` +
        `You can ask me about creating a budget, saving tips, or anything else. ` +
        `If you enter your income and expenses in the dashboard, I can give you personalized advice too!`;
    }

    // ── Help / What can you do ───────────
    if (/\b(help|what can you do|what do you do|capabilities)\b/.test(msg)) {
      return `Here's what I can help with:<br><br>` +
        `• <strong>Budget creation</strong> — I'll help you build a budget step by step<br>` +
        `• <strong>Spending analysis</strong> — Understand where your money goes<br>` +
        `• <strong>Saving tips</strong> — Learn how much to save and where to cut back<br>` +
        `• <strong>Financial concepts</strong> — Needs vs wants, 50/30/20 rule, emergency funds<br>` +
        `• <strong>Calculations</strong> — "Can I afford X?" or "How much do I have left?"<br><br>` +
        `Just ask in plain language! 😊`;
    }

    // ── Explain my budget ────────────────
    if (/\b(explain|show|describe|tell me about)\s*(my\s*)?(budget|finances|money|spending)\b/.test(msg) ||
        msg === "explain my budget") {
      if (!ctx.hasIncome && !ctx.hasExpenses) {
        return `You haven't entered any budget data yet. Set your monthly income and add some expenses ` +
          `in the dashboard above, then ask me again and I'll break everything down for you!`;
      }
      if (!ctx.hasIncome) {
        return `You have expenses but no income set yet. Set your monthly income in the dashboard ` +
          `so I can give you a complete analysis.`;
      }

      const expPercent = ((ctx.totalExpenses / ctx.income) * 100).toFixed(1);
      const remPercent = ((ctx.remaining / ctx.income) * 100).toFixed(1);

      let reply = `Here's your budget overview:<br><br>`;
      reply += `📊 <strong>Income:</strong> ${fmt(ctx.income)} ${curr}<br>`;
      reply += `💸 <strong>Total Expenses:</strong> ${fmt(ctx.totalExpenses)} (${expPercent}% of income)<br>`;

      if (ctx.isOverBudget) {
        reply += `<br>⚠️ <strong>You're over budget by ${fmt(Math.abs(ctx.remaining))}!</strong> ` +
          `Your expenses exceed your income.`;
      } else {
        reply += `💰 <strong>Remaining:</strong> ${fmt(ctx.remaining)} (${remPercent}% of income)<br>`;
      }

      if (ctx.breakdown.length > 0) {
        reply += `<br><strong>Spending by category:</strong><br>`;
        ctx.breakdown.forEach((item) => {
          reply += `• ${item.category}: ${fmt(item.amount)} (${item.percent.toFixed(1)}%)<br>`;
        });
      }

      return reply;
    }

    // ── How much do I have left ──────────
    if (/\b(how much|remaining|left|balance|left over|left after)\b/.test(msg) &&
        /\b(have|left|remaining|balance|money)\b/.test(msg)) {
      if (!ctx.hasIncome) {
        return `I don't know your income yet. Set your monthly income in the dashboard and I'll tell you ` +
          `exactly how much you have left after expenses.`;
      }
      if (ctx.isOverBudget) {
        return `⚠️ Your expenses are <strong>${fmt(Math.abs(ctx.remaining))}</strong> more than your income. ` +
          `You're currently over budget. Would you like tips on reducing your spending?`;
      }
      return `After all your planned expenses, you have <strong>${fmt(ctx.remaining)} ${curr}</strong> remaining. ` +
        `That's <strong>${((ctx.remaining / ctx.income) * 100).toFixed(1)}%</strong> of your income unallocated. ` +
        `This is the money available for savings, unexpected costs, or extra spending.`;
    }

    // ── Can I afford X ───────────────────
    const affordMatch = msg.match(/(?:can i afford|afford)\s+(?:a\s+|an\s+)?(?:another\s+)?([\d,]+(?:\.\d+)?)/);
    if (affordMatch) {
      const amount = parseFloat(affordMatch[1].replace(/,/g, ""));
      if (isNaN(amount) || amount <= 0) {
        return `Please tell me a valid amount. For example: "Can I afford 5000?"`;
      }
      if (!ctx.hasIncome) {
        return `Set your income in the dashboard first, and I'll check if you can afford <strong>${fmt(amount)}</strong>.`;
      }
      const newRemaining = ctx.remaining - amount;
      if (newRemaining < 0) {
        return `That would put you <strong>${fmt(Math.abs(newRemaining))}</strong> over budget. ` +
          `You currently have <strong>${fmt(ctx.remaining)}</strong> remaining, so <strong>${fmt(amount)}</strong> ` +
          `is more than what's left. Consider a smaller amount or look for expenses to reduce.`;
      }
      const advicePercent = ((newRemaining / ctx.income) * 100).toFixed(1);
      return `Yes! After spending <strong>${fmt(amount)}</strong>, you'd still have <strong>${fmt(newRemaining)} ${curr}</strong> ` +
        `remaining (${advicePercent}% of your income). ` +
        (newRemaining / ctx.income > 0.1
          ? `That still leaves a comfortable buffer. ✅`
          : `That's cutting it close though — try to keep at least 10% of your income unallocated.`);
    }

    // ── How much did I spend ─────────────
    if (/\b(how much|total)\s*(did i|have i|am i)\s*(spent|spend|spending)\b/.test(msg)) {
      if (!ctx.hasExpenses) {
        return `You haven't added any expenses yet. Add some in the dashboard and I'll tell you your total spending!`;
      }
      return `You've spent a total of <strong>${fmt(ctx.totalExpenses)} ${curr}</strong>` +
        (ctx.hasIncome ? ` out of your <strong>${fmt(ctx.income)}</strong> income` : ``) +
        `. That's across <strong>${state.expenses.length}</strong> expense` +
        (state.expenses.length !== 1 ? "s" : "") +
        ` in <strong>${ctx.breakdown.length}</strong> categor` +
        (ctx.breakdown.length !== 1 ? "ies" : "y") + `.`;
    }

    // ── Where is most of my money going ──
    if (/\b(where|most|biggest|largest|highest|top)\b.*\b(money|spend|spending|expense|going)\b/.test(msg)) {
      if (!ctx.hasExpenses) {
        return `Add some expenses in the dashboard first, and I'll show you where most of your money is going!`;
      }
      const top = ctx.breakdown[0];
      let reply = `Your biggest spending category is <strong>${top.category}</strong> at ` +
        `<strong>${fmt(top.amount)}</strong> (${top.percent.toFixed(1)}% of total expenses).`;
      if (ctx.breakdown.length >= 2) {
        reply += ` The second largest is <strong>${ctx.breakdown[1].category}</strong> ` +
          `at <strong>${fmt(ctx.breakdown[1].amount)}</strong>.`;
      }
      if (top.percent > 40) {
        reply += `<br><br>💡 Having one category above 40% of your spending can be risky. ` +
          `Diversifying your budget helps handle unexpected costs.`;
      }
      return reply;
    }

    // ── How much should I save ───────────
    if (/\b(how much|should i|need to)\s*(save|saving|set aside)\b/.test(msg)) {
      if (!ctx.hasIncome) {
        return `Set your income in the dashboard first, and I can give you a specific savings target! ` +
          `As a general rule, financial experts recommend saving at least <strong>20%</strong> of your income.`;
      }
      const twenty = Math.round(ctx.income * 0.2);
      const ten = Math.round(ctx.income * 0.1);
      let reply = `A common guideline is to save at least <strong>20% of your income</strong>.<br><br>`;
      reply += `For your income of <strong>${fmt(ctx.income)}</strong>:<br>`;
      reply += `• <strong>Ideal savings:</strong> ${fmt(twenty)} per month (20%)<br>`;
      reply += `• <strong>Minimum target:</strong> ${fmt(ten)} per month (10%)<br><br>`;
      if (ctx.remaining >= twenty) {
        reply += `Great news — you have <strong>${fmt(ctx.remaining)}</strong> remaining, which is enough to hit the 20% target! ` +
          `Consider adding a "Savings" expense of <strong>${fmt(twenty)}</strong> to track it.`;
      } else if (ctx.remaining >= ten) {
        reply += `You have <strong>${fmt(ctx.remaining)}</strong> remaining, which covers the 10% minimum but not the ideal 20%. ` +
          `Try reducing some non-essential expenses to reach the higher target.`;
      } else if (ctx.remaining > 0) {
        reply += `Your remaining balance is only <strong>${fmt(ctx.remaining)}</strong>. ` +
          `Look for expenses you can reduce — even small cuts add up over time.`;
      } else {
        reply += `⚠️ You're currently over budget. Before saving, focus on bringing your expenses below your income.`;
      }
      return reply;
    }

    // ── Help me make a budget ────────────
    if (/\b(make|create|build|start|plan)\s*(a\s*)?(budget|plan)\b/.test(msg)) {
      return `Let's build a budget together! Here's a simple approach:<br><br>` +
        `<strong>Step 1:</strong> Set your monthly income in the dashboard above.<br>` +
        `<strong>Step 2:</strong> List your fixed expenses (rent, utilities, transport) — these are <strong>needs</strong>.<br>` +
        `<strong>Step 3:</strong> Add your variable expenses (food, entertainment) — these mix needs and <strong>wants</strong>.<br>` +
        `<strong>Step 4:</strong> Use the <strong>50/30/20 rule</strong> as a guide:<br>` +
        `• 50% for needs (housing, food, utilities)<br>` +
        `• 30% for wants (entertainment, dining out)<br>` +
        `• 20% for savings and debt repayment<br><br>` +
        `<strong>Step 5:</strong> Click "Analyze My Budget" below the calculator for personalized tips! ` +
        `Or ask me about any part of this process.`;
    }

    // ── Reduce spending ──────────────────
    if (/\b(reduce|cut|lower|decrease|less|save on|spend less)\b.*\b(spending|expenses|cost|costs|money)\b/.test(msg)) {
      if (!ctx.hasExpenses) {
        return `Add your expenses in the dashboard first, and I'll identify specific areas where you can cut back!`;
      }
      let reply = `Here are some practical ways to reduce spending:<br><br>`;

      // Find discretionary categories
      const discretionary = ctx.breakdown.filter(
        (item) => ["Entertainment", "Shopping", "Food & Dining"].includes(item.category)
      );
      if (discretionary.length > 0) {
        const total = discretionary.reduce((sum, item) => sum + item.amount, 0);
        reply += `📍 <strong>Quick wins</strong> — you spend <strong>${fmt(total)}</strong> on ` +
          discretionary.map((d) => d.category).join(", ") + `. ` +
          `Try reducing these by 10-20%.<br><br>`;
      }

      reply += `💡 <strong>General tips:</strong><br>`;
      reply += `• Cook at home more often instead of eating out<br>`;
      reply += `• Review subscriptions — cancel ones you rarely use<br>`;
      reply += `• Use public transport or carpool when possible<br>`;
      reply += `• Wait 24 hours before non-essential purchases<br>`;
      reply += `• Buy generic brands for everyday items`;
      return reply;
    }

    // ── 50/30/20 rule ────────────────────
    if (/\b50.?30.?20\b/.test(msg) || /\b(budgeting?\s*(rule|method|principle))\b/.test(msg)) {
      let reply = `The <strong>50/30/20 rule</strong> is a simple budgeting framework:<br><br>`;
      reply += `• <strong>50% Needs</strong> — Essentials like rent, groceries, utilities, transport<br>`;
      reply += `• <strong>30% Wants</strong> — Entertainment, dining out, hobbies, shopping<br>`;
      reply += `• <strong>20% Savings</strong> — Emergency fund, investments, debt repayment<br><br>`;

      if (ctx.hasIncome) {
        reply += `With your income of <strong>${fmt(ctx.income)}</strong>:<br>`;
        reply += `• Needs: up to <strong>${fmt(ctx.income * 0.5)}</strong><br>`;
        reply += `• Wants: up to <strong>${fmt(ctx.income * 0.3)}</strong><br>`;
        reply += `• Savings: at least <strong>${fmt(ctx.income * 0.2)}</strong><br><br>`;
        reply += `Compare this with your actual spending to see where you stand!`;
      } else {
        reply += `Set your income in the dashboard and I'll calculate the exact amounts for you!`;
      }
      return reply;
    }

    // ── Needs vs wants ───────────────────
    if (/\b(needs?\s*(vs|versus|and|or)\s*wants?|difference.*needs.*wants|wants?\s*(vs|versus|and)\s*needs?)\b/.test(msg)) {
      return `<strong>Needs</strong> are things you must have to live and work:<br>` +
        `• Housing (rent/mortgage)<br>• Basic groceries<br>• Utilities (electricity, water)<br>` +
        `• Transportation to work/school<br>• Healthcare<br><br>` +
        `<strong>Wants</strong> are nice-to-haves you could live without:<br>` +
        `• Dining out / ordering food<br>• Entertainment (Netflix, games)<br>` +
        `• New clothes (beyond basics)<br>• Latest gadgets<br><br>` +
        `💡 <strong>Tip:</strong> The line between needs and wants can be blurry. ` +
        `A phone might be a need, but the newest iPhone is a want. ` +
        `Groceries are a need, but expensive brands are a want. ` +
        `A good test: "Could I postpone this purchase for a month?"`;
    }

    // ── Emergency fund ───────────────────
    if (/\b(emergency\s*fund|rainy\s*day|safety\s*net|backup\s*(money|fund|savings))\b/.test(msg)) {
      let reply = `An <strong>emergency fund</strong> is money set aside for unexpected costs ` +
        `(medical bills, car repairs, job loss).<br><br>`;
      reply += `<strong>How much?</strong> Aim for <strong>3-6 months</strong> of essential expenses.<br><br>`;

      if (ctx.hasExpenses) {
        const monthly = ctx.totalExpenses;
        reply += `Based on your spending of <strong>${fmt(monthly)}</strong>/month:<br>`;
        reply += `• <strong>3-month fund:</strong> ${fmt(monthly * 3)}<br>`;
        reply += `• <strong>6-month fund:</strong> ${fmt(monthly * 6)}<br><br>`;
      }

      reply += `<strong>How to build it:</strong><br>`;
      reply += `• Start small — even ${fmt(500)}/month adds up<br>`;
      reply += `• Keep it in a separate account so you're not tempted<br>`;
      reply += `• Only use it for true emergencies, not wants`;
      return reply;
    }

    // ── General saving tips ──────────────
    if (/\b(tips?|advice|ways?|how to)\b.*\b(save|saving|money)\b/.test(msg) ||
        /\bsav(e|ing)\s*(tips?|advice|money|ideas)\b/.test(msg)) {
      return `Here are practical saving tips:<br><br>` +
        `💰 <strong>Pay yourself first</strong> — Set aside savings as soon as you get paid, not at month's end.<br><br>` +
        `📱 <strong>Track every expense</strong> — Use this dashboard! Awareness alone can reduce spending by 10-15%.<br><br>` +
        `🛒 <strong>Use the 24-hour rule</strong> — Wait a day before any non-essential purchase.<br><br>` +
        `🍳 <strong>Cook more at home</strong> — Eating out is typically 3-5x more expensive than cooking.<br><br>` +
        `📋 <strong>Make a shopping list</strong> — And stick to it. Impulse buying adds up fast.<br><br>` +
        `🔄 <strong>Review subscriptions</strong> — Cancel what you haven't used in the past month.`;
    }

    // ── I have X left, what can I do ─────
    const haveLeftMatch = msg.match(/(?:i have|i've got|have)\s+([\d,]+(?:\.\d+)?)\s*(?:left|remaining|extra|to spend|rs\.?|pkr|usd)?/);
    if (haveLeftMatch && /\b(what|how|should|can|do|spend|invest|save)\b/.test(msg)) {
      const amount = parseFloat(haveLeftMatch[1].replace(/,/g, ""));
      if (!isNaN(amount) && amount > 0) {
        const save60 = Math.round(amount * 0.6);
        const spend40 = amount - save60;
        return `With <strong>${fmt(amount)} ${curr}</strong> available, here's a balanced approach:<br><br>` +
          `• <strong>Save ${fmt(save60)}</strong> (60%) — Put this in your savings or emergency fund<br>` +
          `• <strong>Keep ${fmt(spend40)}</strong> (40%) — Use for flexible or unexpected spending<br><br>` +
          `If you have any high-interest debt, prioritize paying that down before saving. ` +
          `Would you like tips on building an emergency fund?`;
      }
    }

    // ── What is a budget / basic concepts ─
    if (/\b(what is|what's|define|explain)\s*(a\s*)?(budget|budgeting)\b/.test(msg)) {
      return `A <strong>budget</strong> is simply a plan for your money. It tracks:<br><br>` +
        `1. <strong>Income</strong> — Money coming in (salary, allowance, side jobs)<br>` +
        `2. <strong>Expenses</strong> — Money going out (rent, food, transport, fun)<br>` +
        `3. <strong>Remaining</strong> — What's left for savings or goals<br><br>` +
        `The goal: make sure your expenses don't exceed your income, and that you're saving something each month. ` +
        `That's it — budgeting doesn't have to be complicated! 😊`;
    }

    // ── Thank you ────────────────────────
    if (/\b(thanks|thank you|thx|ty|appreciate)\b/.test(msg)) {
      return `You're welcome! 😊 Feel free to ask me anything else about your budget or personal finance.`;
    }

    // ── Disclaimer for investment/tax/legal ──
    if (/\b(invest|investing|investment|stock|stocks|crypto|bitcoin|mutual fund|tax|legal|lawyer|attorney)\b/.test(msg)) {
      return `That's a great topic, but I'm designed to help with <strong>basic budgeting and spending</strong>, ` +
        `not investment, tax, or legal advice. For those topics, I'd recommend speaking with a qualified professional ` +
        `or using a dedicated financial advisory service.<br><br>` +
        `I'm happy to help with things like creating a budget, tracking expenses, and saving tips!`;
    }

    // ── Default / Fallback ───────────────
    return `That's a good question! I'm best at helping with:<br><br>` +
      `• <strong>Budget questions</strong> — "Explain my budget", "How much do I have left?"<br>` +
      `• <strong>Calculations</strong> — "Can I afford 5000?"<br>` +
      `• <strong>Saving advice</strong> — "How much should I save?"<br>` +
      `• <strong>Spending tips</strong> — "Help me reduce spending"<br>` +
      `• <strong>Financial basics</strong> — "What's the 50/30/20 rule?"<br><br>` +
      `Try rephrasing your question or pick one of the suggestions below! 💡`;
  },
};

// ──────────────────────────────────────────────
// 6. EVENT HANDLERS (now async — they call the API)
// ──────────────────────────────────────────────

/** Handle income form submission. */
async function handleIncomeSubmit(event) {
  event.preventDefault();

  const value = parseFloat(dom.incomeInput.value);

  if (isNaN(value) || value < 0) {
    alert("Please enter a valid income amount.");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/api/income", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value }),
    });

    if (!res.ok) throw new Error("Failed to update income");

    const data = await res.json();
    state.income = data.income;
    render();
  } catch (err) {
    showError("Could not save income. Please try again.");
  }
}

/** Handle expense form submission. */
async function handleExpenseSubmit(event) {
  event.preventDefault();

  const name     = dom.expenseName.value.trim();
  const amount   = parseFloat(dom.expenseAmount.value);
  const category = dom.expenseCategory.value;

  // Validate
  if (!name) {
    alert("Please enter an expense name.");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount greater than 0.");
    return;
  }
  if (!category) {
    alert("Please select a category.");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount, category }),
    });

    if (!res.ok) throw new Error("Failed to add expense");

    const newExpense = await res.json();

    // Map backend response to frontend state shape
    state.expenses.push({
      id: newExpense.id,
      name: newExpense.name,
      amount: newExpense.amount,
      category: newExpense.category,
      createdAt: newExpense.created_at,
    });

    render();
    dom.expenseForm.reset();
  } catch (err) {
    showError("Could not add expense. Please try again.");
  }
}

/** Handle delete button clicks (event delegation on the list). */
async function handleExpenseListClick(event) {
  const btn = event.target.closest(".delete-btn");
  if (!btn) return;

  const id = btn.dataset.id;

  try {
    const res = await fetch(API_BASE + "/api/expenses/" + id, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error("Failed to delete expense");

    // Remove from local state
    state.expenses = state.expenses.filter((exp) => exp.id !== id);
    render();
  } catch (err) {
    showError("Could not delete expense. Please try again.");
  }
}

// ──────────────────────────────────────────────
// 7. INITIALISE
//    Wire up events and load data from the backend.
// ──────────────────────────────────────────────

async function init() {
  // Load saved currency preference
  try {
    const savedCurrency = localStorage.getItem("finmate_currency");
    if (savedCurrency && CURRENCIES[savedCurrency]) {
      state.currency = savedCurrency;
    }
  } catch (e) { /* localStorage not available */ }

  // Event listeners — existing
  dom.incomeForm.addEventListener("submit", handleIncomeSubmit);
  dom.expenseForm.addEventListener("submit", handleExpenseSubmit);
  dom.expenseList.addEventListener("click", handleExpenseListClick);
  dom.aiAnalyzeBtn.addEventListener("click", handleAIAnalyze);

  // Event listeners — currency
  dom.currencySelect.addEventListener("change", handleCurrencyChange);

  // Event listeners — chat
  dom.chatToggleBtn.addEventListener("click", toggleChat);
  dom.chatCloseBtn.addEventListener("click", closeChat);
  dom.chatClearBtn.addEventListener("click", clearChat);
  dom.chatInputForm.addEventListener("submit", handleChatSend);
  dom.chatPrompts.addEventListener("click", handlePromptClick);

  // Load initial data from the backend
  await fetchAllData();
}

// Kick things off once the DOM is ready
document.addEventListener("DOMContentLoaded", init);
