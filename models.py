"""
FinMate AI — models.py
Pydantic models for request validation and response serialization.

These models ensure that:
- Incoming requests have the correct shape and data types.
- Outgoing responses are consistent and well-structured.
- FastAPI auto-generates validation errors for bad input.
"""

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# INCOME MODELS
# ──────────────────────────────────────────────

class IncomeUpdate(BaseModel):
    """Request body for setting/updating monthly income."""
    amount: float = Field(
        ...,
        ge=0,
        description="Monthly income amount (must be 0 or greater)"
    )


class IncomeResponse(BaseModel):
    """Response after getting or updating income."""
    income: float


# ──────────────────────────────────────────────
# EXPENSE MODELS
# ──────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    """Request body for adding a new expense."""
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name or description of the expense"
    )
    amount: float = Field(
        ...,
        gt=0,
        description="Expense amount (must be greater than 0)"
    )
    category: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Spending category (e.g. Food & Dining, Transportation)"
    )


class ExpenseResponse(BaseModel):
    """A single expense as returned in responses."""
    id: str
    name: str
    amount: float
    category: str
    created_at: float


class ExpenseListResponse(BaseModel):
    """Response wrapper for a list of expenses."""
    expenses: list[ExpenseResponse]


# ──────────────────────────────────────────────
# SUMMARY MODELS
# ──────────────────────────────────────────────

class CategoryBreakdown(BaseModel):
    """Spending total for a single category."""
    category: str
    amount: float
    percent: float


class SummaryResponse(BaseModel):
    """Full financial summary."""
    income: float
    total_expenses: float
    remaining_balance: float
    breakdown: list[CategoryBreakdown]


# ──────────────────────────────────────────────
# CHAT MODELS
# ──────────────────────────────────────────────

class ChatMessage(BaseModel):
    """A single message in the chat history."""
    role: str = Field(
        ...,
        description="Role of the message sender: 'user' or 'assistant'"
    )
    text: str = Field(
        ...,
        description="Message content"
    )


class BudgetContext(BaseModel):
    """Budget context sent alongside chat messages."""
    income: float = Field(default=0, ge=0)
    total_expenses: float = Field(default=0, ge=0)
    remaining: float = Field(default=0)
    currency: str = Field(default="USD")
    expense_count: int = Field(default=0, ge=0)
    breakdown: list[CategoryBreakdown] = Field(default_factory=list)


class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""
    message: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="The user's message"
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="Previous messages in the conversation"
    )
    context: BudgetContext = Field(
        default_factory=BudgetContext,
        description="Current budget data for contextual responses"
    )


class ChatResponse(BaseModel):
    """Response from the chat endpoint."""
    reply: str
