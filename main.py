"""
FinMate AI — main.py
FastAPI application with API routes and CORS configuration.

Run the server with:
    uvicorn main:app --reload --port 8000

Then open http://localhost:8000/docs to see the interactive API docs.
"""

import os
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    IncomeUpdate,
    IncomeResponse,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseListResponse,
    SummaryResponse,
    CategoryBreakdown,
    ChatRequest,
    ChatResponse,
    ChatMessage,
    BudgetContext,
)
from store import (
    get_income,
    set_income,
    get_expenses,
    add_expense,
    delete_expense,
)


# ──────────────────────────────────────────────
# APP SETUP
# ──────────────────────────────────────────────

app = FastAPI(
    title="FinMate AI API",
    description="Backend API for the FinMate AI personal finance assistant.",
    version="0.1.0",
)

# CORS — allow the frontend to call this backend
# In production, set FRONTEND_URL env var to your Vercel URL
# Locally, defaults to localhost:3000
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],       # Allow all HTTP methods
    allow_headers=["*"],       # Allow all headers
)


# ──────────────────────────────────────────────
# INCOME ENDPOINTS
# ──────────────────────────────────────────────

@app.get("/api/income", response_model=IncomeResponse, tags=["Income"])
def read_income():
    """Get the current monthly income."""
    return IncomeResponse(income=get_income())


@app.put("/api/income", response_model=IncomeResponse, tags=["Income"])
def update_income(body: IncomeUpdate):
    """Set or update the monthly income.

    Replaces the previous income value entirely.
    """
    updated = set_income(body.amount)
    return IncomeResponse(income=updated)


# ──────────────────────────────────────────────
# EXPENSE ENDPOINTS
# ──────────────────────────────────────────────

@app.get("/api/expenses", response_model=ExpenseListResponse, tags=["Expenses"])
def list_expenses():
    """Get all expenses, sorted by creation date (newest first)."""
    expenses = get_expenses()

    # Sort newest first by created_at timestamp
    expenses_sorted = sorted(expenses, key=lambda e: e["created_at"], reverse=True)

    return ExpenseListResponse(expenses=expenses_sorted)


@app.post("/api/expenses", response_model=ExpenseResponse, status_code=201, tags=["Expenses"])
def create_expense(body: ExpenseCreate):
    """Add a new expense.

    The backend generates a unique id and timestamp automatically.
    """
    expense = {
        "id": uuid.uuid4().hex[:12],
        "name": body.name,
        "amount": body.amount,
        "category": body.category,
        "created_at": time.time(),
    }

    saved = add_expense(expense)
    return ExpenseResponse(**saved)


@app.delete("/api/expenses/{expense_id}", tags=["Expenses"])
def remove_expense(expense_id: str):
    """Delete an expense by its id.

    Returns 200 on success, 404 if the expense is not found.
    """
    deleted = delete_expense(expense_id)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Expense with id '{expense_id}' not found."
        )

    return {"message": "Expense deleted", "id": expense_id}


# ──────────────────────────────────────────────
# SUMMARY ENDPOINT
# ──────────────────────────────────────────────

@app.get("/api/summary", response_model=SummaryResponse, tags=["Summary"])
def get_summary():
    """Get a full financial summary: income, total expenses,
    remaining balance, and spending breakdown by category.
    """
    income = get_income()
    expenses = get_expenses()

    # Calculate totals
    total_expenses = sum(exp["amount"] for exp in expenses)
    remaining_balance = income - total_expenses

    # Calculate category breakdown
    category_totals: dict[str, float] = {}
    for exp in expenses:
        cat = exp["category"]
        category_totals[cat] = category_totals.get(cat, 0) + exp["amount"]

    breakdown = []
    for category, amount in sorted(category_totals.items(), key=lambda x: x[1], reverse=True):
        percent = (amount / total_expenses * 100) if total_expenses > 0 else 0.0
        breakdown.append(CategoryBreakdown(
            category=category,
            amount=round(amount, 2),
            percent=round(percent, 1),
        ))

    return SummaryResponse(
        income=income,
        total_expenses=round(total_expenses, 2),
        remaining_balance=round(remaining_balance, 2),
        breakdown=breakdown,
    )


# ──────────────────────────────────────────────
# CHAT ENDPOINT
# ──────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
def chat(body: ChatRequest):
    """Process a chat message from the FinMate AI Assistant.

    CURRENT: Returns a server-side acknowledgement while the
    main chatbot engine runs client-side (rule-based).

    FUTURE: Replace this function body with a call to an AI API
    (OpenAI, Google Gemini, etc.) using the request context:
      - body.message   → the user's latest message
      - body.history   → full conversation history
      - body.context   → the user's current budget data

    Example future implementation:
        prompt = build_prompt(body.message, body.history, body.context)
        ai_reply = await openai_client.chat(prompt)
        return ChatResponse(reply=ai_reply)
    """
    # Build a simple server-side response using budget context
    ctx = body.context
    msg = body.message.lower().strip()

    # Server can provide budget-aware responses when the client
    # engine is not sufficient (e.g. for future AI API integration).
    # For now, echo a helpful acknowledgement.
    if ctx.income > 0 or ctx.expense_count > 0:
        reply = (
            f"I can see your budget data: "
            f"income {ctx.income:.2f} {ctx.currency}, "
            f"expenses {ctx.total_expenses:.2f} {ctx.currency}, "
            f"remaining {ctx.remaining:.2f} {ctx.currency}. "
            f"The FinMate AI assistant is processing your question on the client side "
            f"for the best experience."
        )
    else:
        reply = (
            "Welcome to FinMate AI! "
            "Start by entering your income and expenses in the dashboard, "
            "then ask me anything about your budget."
        )

    return ChatResponse(reply=reply)


# ──────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "app": "FinMate AI API"}


# ──────────────────────────────────────────────
# STARTUP
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
