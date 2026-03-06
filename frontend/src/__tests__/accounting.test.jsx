// ============================================================
// __tests__/accounting.test.jsx — 세무/회계 프론트엔드 vitest 테스트
// 유틸리티 함수와 컴포넌트 렌더링을 검증합니다.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  formatCurrency,
  formatPercent,
  formatDateKo,
  fetchCategories,
} from "../api/accountingApi";
import ExpenseForm from "../components/modules/accounting/ExpenseForm";

// API 모듈 전체를 모킹
vi.mock("../api/accountingApi", async () => {
  const actual = await vi.importActual("../api/accountingApi");
  return {
    ...actual,
    // 실제 네트워크 요청 대신 가짜 데이터 반환
    fetchCategories: vi.fn().mockResolvedValue([
      { id: 1, name: "식재료비", color: "#3B82F6" },
      { id: 2, name: "인건비", color: "#8B5CF6" },
    ]),
    createExpense: vi.fn().mockResolvedValue({ id: 1, description: "테스트 지출" }),
  };
});

// ─────────────────────────────────────────
// 유틸리티 함수 단위 테스트
// ─────────────────────────────────────────

describe("formatCurrency - 금액 포맷 함수", () => {
  it("1234567 → '1,234,567원' 으로 변환", () => {
    expect(formatCurrency(1234567)).toBe("1,234,567원");
  });

  it("0 → '0원' 반환", () => {
    expect(formatCurrency(0)).toBe("0원");
  });

  it("null → '0원' 반환", () => {
    expect(formatCurrency(null)).toBe("0원");
  });

  it("소수점 금액도 정상 처리", () => {
    // 소수점은 반올림하지 않고 그대로 표시
    expect(formatCurrency(1000.5)).toBe("1,000.5원");
  });

  it("음수 금액도 처리", () => {
    expect(formatCurrency(-50000)).toBe("-50,000원");
  });
});

describe("formatPercent - 퍼센트 포맷 함수", () => {
  it("32.5 → '32.5%' 반환", () => {
    expect(formatPercent(32.5)).toBe("32.5%");
  });

  it("showSign=true이고 양수이면 '+8.0%' 반환", () => {
    expect(formatPercent(8, true)).toBe("+8.0%");
  });

  it("showSign=true이고 음수이면 '-5.3%' 반환", () => {
    expect(formatPercent(-5.3, true)).toBe("-5.3%");
  });

  it("null → '-' 반환", () => {
    expect(formatPercent(null)).toBe("-");
  });
});

describe("formatDateKo - 날짜 한국어 변환 함수", () => {
  it("'2026-03-04' → '2026년 3월 4일' 변환", () => {
    expect(formatDateKo("2026-03-04")).toBe("2026년 3월 4일");
  });

  it("빈 문자열 → 빈 문자열 반환", () => {
    expect(formatDateKo("")).toBe("");
  });

  it("'2026-01-01' → '2026년 1월 1일' 변환 (앞자리 0 제거)", () => {
    expect(formatDateKo("2026-01-01")).toBe("2026년 1월 1일");
  });
});

// ─────────────────────────────────────────
// ExpenseForm 컴포넌트 렌더링 테스트
// ─────────────────────────────────────────

describe("ExpenseForm 컴포넌트", () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("폼이 정상적으로 렌더링됨", async () => {
    render(<ExpenseForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    // 제목 확인
    expect(screen.getByText("지출 입력")).toBeTruthy();
    // 필수 입력 필드 확인
    expect(screen.getByPlaceholderText("예: 활전복 50kg 구매")).toBeTruthy();
  });

  it("분류 선택 드롭다운에 카테고리 목록이 표시됨", async () => {
    render(<ExpenseForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    // API가 호출될 때까지 대기
    await waitFor(() => {
      expect(fetchCategories).toHaveBeenCalled();
    });
  });

  it("취소 버튼 클릭 시 onCancel이 호출됨", async () => {
    render(<ExpenseForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    const cancelButton = screen.getByText("취소");
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("필수 필드 비어있을 때 저장 시 에러 메시지 표시", async () => {
    render(<ExpenseForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    // 저장 버튼 클릭 (필수 필드 비어있는 상태)
    const saveButton = screen.getByText("저장");
    fireEvent.click(saveButton);
    // 에러 메시지 확인
    await waitFor(() => {
      expect(screen.getByText("지출 내용을 입력해주세요.")).toBeTruthy();
    });
  });

  it("수정 모드에서 초기 데이터가 폼에 채워짐", async () => {
    const initialData = {
      id: 1,
      expense_date: "2026-03-04",
      category_id: 1,
      description: "기존 지출 내용",
      amount: 100000,
      vat: 10000,
      payment_method: "카드",
    };
    render(
      <ExpenseForm
        initialData={initialData}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );
    // 수정 모드 제목 확인
    expect(screen.getByText("지출 수정")).toBeTruthy();
    // 초기값이 입력 필드에 채워져 있는지 확인
    const descriptionInput = screen.getByPlaceholderText("예: 활전복 50kg 구매");
    expect(descriptionInput.value).toBe("기존 지출 내용");
  });
});
