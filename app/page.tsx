"use client";

import { useEffect, useMemo, useState } from "react";
import verses from "./verses.json";

type View = "library" | "practice" | "test";
type TestType = "write" | "reference";
type TestSelectionMode = "selected" | "range";
type TokenResult = { word: string; answerWord: string; correct: boolean; confirmed: boolean };

const pageSize = 10;
const testLabels: Record<TestType, string> = { write: "장절 보고 구절 맞추기", reference: "구절 보고 장절 맞추기" };

function words(text: string) { return text.trim().split(/\s+/).filter(Boolean); }
function compareWords(expected: string, answer: string): TokenResult[] {
  const expectedWords = words(expected); const answerWords = words(answer);
  const costs = Array.from({ length: expectedWords.length + 1 }, () => Array(answerWords.length + 1).fill(0));
  for (let expectedIndex = expectedWords.length; expectedIndex >= 0; expectedIndex -= 1) costs[expectedIndex][answerWords.length] = expectedWords.length - expectedIndex;
  for (let answerIndex = answerWords.length; answerIndex >= 0; answerIndex -= 1) costs[expectedWords.length][answerIndex] = answerWords.length - answerIndex;
  for (let expectedIndex = expectedWords.length - 1; expectedIndex >= 0; expectedIndex -= 1) {
    for (let answerIndex = answerWords.length - 1; answerIndex >= 0; answerIndex -= 1) {
      if (expectedWords[expectedIndex] === answerWords[answerIndex]) costs[expectedIndex][answerIndex] = costs[expectedIndex + 1][answerIndex + 1];
      else costs[expectedIndex][answerIndex] = Math.min(costs[expectedIndex + 1][answerIndex], costs[expectedIndex][answerIndex + 1], costs[expectedIndex + 1][answerIndex + 1]) + 1;
    }
  }
  const results: TokenResult[] = [];
  let expectedIndex = 0; let answerIndex = 0;
  while (expectedIndex < expectedWords.length || answerIndex < answerWords.length) {
    if (expectedIndex < expectedWords.length && answerIndex < answerWords.length && expectedWords[expectedIndex] === answerWords[answerIndex]) {
      results.push({ word: expectedWords[expectedIndex], answerWord: answerWords[answerIndex], correct: true, confirmed: true }); expectedIndex += 1; answerIndex += 1; continue;
    }
    const currentCost = costs[expectedIndex]?.[answerIndex] ?? 0;
    const deletionCost = expectedIndex < expectedWords.length ? costs[expectedIndex + 1][answerIndex] + 1 : Infinity;
    const insertionCost = answerIndex < answerWords.length ? costs[expectedIndex][answerIndex + 1] + 1 : Infinity;
    if (deletionCost === currentCost) {
      results.push({ word: expectedWords[expectedIndex], answerWord: "", correct: false, confirmed: answerIndex < answerWords.length }); expectedIndex += 1;
    } else if (insertionCost === currentCost) {
      results.push({ word: "", answerWord: answerWords[answerIndex], correct: false, confirmed: true }); answerIndex += 1;
    } else {
      results.push({ word: expectedWords[expectedIndex], answerWord: answerWords[answerIndex], correct: false, confirmed: true }); expectedIndex += 1; answerIndex += 1;
    }
  }
  return results;
}
function VerseLines({ lines }: { lines: string[] }) { return <span className="verse-lines">{lines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</span>; }
function PracticeText({ expected, answer }: { expected: string; answer: string }) {
  const comparison = compareWords(expected, answer);
  return <span className="practice-compare">{comparison.map((item, index) => <span key={`${item.word}-${index}`} className={item.correct ? "correct" : item.confirmed ? "wrong" : "pending"}>{item.word}{index < comparison.length - 1 ? " " : ""}</span>)}</span>;
}
function ComparisonView({ expected, answer }: { expected: string; answer: string }) {
  const comparison = compareWords(expected, answer);
  return <div className="comparison-view"><p><strong>원본</strong><span>{comparison.map((item, index) => <span key={`expected-${index}`} className={item.correct ? "correct" : "wrong"}>{item.word || "∅"} </span>)}</span></p><p><strong>작성한 내용</strong><span>{comparison.map((item, index) => <span key={`answer-${index}`} className={item.correct ? "correct" : "wrong"}>{item.answerWord || "∅"} </span>)}</span></p></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("library");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(1);
  const [verseModalOpen, setVerseModalOpen] = useState(false);
  const [practiceVerseId, setPracticeVerseId] = useState(1);
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [hidePracticeText, setHidePracticeText] = useState(false);
  const [testType, setTestType] = useState<TestType>("write");
  const [testSelectionMode, setTestSelectionMode] = useState<TestSelectionMode>("selected");
  const [selectedTestIds, setSelectedTestIds] = useState<number[]>([1]);
  const [testRangeStart, setTestRangeStart] = useState(1);
  const [testRangeEnd, setTestRangeEnd] = useState(Math.min(10, verses.length));
  const [testOrder, setTestOrder] = useState<number[]>([]);
  const [testIndex, setTestIndex] = useState(0);
  const [testConfigured, setTestConfigured] = useState(false);
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedVerse = verses.find((verse) => verse.id === selectedId) ?? verses[0];
  const availableTestIds = testSelectionMode === "range" ? verses.filter((verse) => verse.id >= Math.min(testRangeStart, testRangeEnd) && verse.id <= Math.max(testRangeStart, testRangeEnd)).map((verse) => verse.id) : selectedTestIds;
  const testIds = testConfigured && testOrder.length > 0 ? testOrder : availableTestIds;
  const testId = testIds[testIndex] ?? testIds[0] ?? 1;
  const testVerse = verses.find((verse) => verse.id === testId) ?? verses[0];
  const pageVerses = verses.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(verses.length / pageSize);
  const practiceExpected = selectedVerse.lines.join(" ");
  const practiceCheckedAnswer = useMemo(() => {
    if (!practiceAnswer.trim() || /\s$/.test(practiceAnswer) || practiceAnswer.trim() === practiceExpected) return practiceAnswer;
    return words(practiceAnswer).slice(0, -1).join(" ");
  }, [practiceAnswer, practiceExpected]);
  const practiceResult = useMemo(() => compareWords(practiceExpected, practiceCheckedAnswer), [practiceExpected, practiceCheckedAnswer]);
  const practiceWrongCount = practiceResult.filter((item) => !item.correct && item.confirmed).length;
  const isReferenceCorrect = selectedOption === testVerse.reference;
  const referenceOptions = useMemo(() => {
    const distractors = verses.filter((verse) => verse.id !== testVerse.id);
    const offset = (testVerse.id * 3) % distractors.length;
    return [testVerse.reference, ...Array.from({ length: 4 }, (_, index) => distractors[(offset + index) % distractors.length].reference)];
  }, [testVerse.id, testVerse.reference]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setVerseModalOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function startPractice() { setSelectedId(practiceVerseId); setPracticeAnswer(""); setPracticeStarted(true); }
  function movePractice(step: number) {
    const nextId = Math.min(Math.max(selectedVerse.id + step, 1), verses.length);
    setSelectedId(nextId);
    setPracticeVerseId(nextId);
    setPracticeAnswer("");
  }
  function startTest() {
    const shuffledIds = [...availableTestIds];
    for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledIds[index], shuffledIds[randomIndex]] = [shuffledIds[randomIndex], shuffledIds[index]];
    }
    setTestOrder(shuffledIds);
    setTestIndex(0);
    setSubmitted(false);
    setAnswer("");
    setSelectedOption("");
    setTestConfigured(true);
  }
  function toggleTestId(id: number) { setSelectedTestIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id].sort((first, second) => first - second)); }
  function nextTestQuestion() { setTestIndex((current) => current + 1); setSubmitted(false); setAnswer(""); setSelectedOption(""); }
  function selectView(nextView: View) { setView(nextView); setSubmitted(false); setAnswer(""); setSelectedOption(""); if (nextView === "practice") { setPracticeStarted(false); setPracticeAnswer(""); } if (nextView === "test") setTestConfigured(false); }

  const practiceContent = practiceStarted ? (
    <div className="practice-card">
      <div className="practice-meta"><span>구절 {selectedVerse.id} / {verses.length}</span><button onClick={() => setPracticeStarted(false)}>설정으로 돌아가기</button></div>
      <div className="practice-navigation"><button aria-label="이전 말씀" disabled={selectedVerse.id === 1} onClick={() => movePractice(-1)}>←</button><strong>{selectedVerse.reference}</strong><button aria-label="다음 말씀" disabled={selectedVerse.id === verses.length} onClick={() => movePractice(1)}>→</button></div>
      <label className="practice-toggle"><input type="checkbox" checked={hidePracticeText} onChange={(event) => setHidePracticeText(event.target.checked)} /> 안보고 타이핑 연습하기</label>
      {!hidePracticeText && <p className="practice-text"><PracticeText expected={practiceExpected} answer={practiceCheckedAnswer} /></p>}
      <textarea className={practiceAnswer.length > 0 && practiceWrongCount > 0 ? "has-error" : ""} value={practiceAnswer} onChange={(event) => setPracticeAnswer(event.target.value)} placeholder="여기에 말씀을 입력해 보세요." aria-label="타이핑 연습 입력" />
      <p className={`practice-status ${practiceWrongCount > 0 ? "has-error" : ""}`} role="status">{practiceAnswer.length === 0 ? "입력을 시작하면 어절 단위로 비교합니다." : practiceWrongCount > 0 ? `다시 한번 잘 확인해보세요.` : practiceResult.every((item) => item.correct) ? "정확합니다. 다음 말씀으로 넘어가 보세요." : "현재까지 입력한 어절은 맞습니다."}</p>
    </div>
  ) : (
    <div className="settings-card setup-card">
      <label>연습할 말씀<select value={practiceVerseId} onChange={(event) => setPracticeVerseId(Number(event.target.value))}>{verses.map((verse) => <option key={verse.id} value={verse.id}>{verse.id}번 · {verse.reference}</option>)}</select></label>
      <p className="setup-note">횟수나 범위 없이, 선택한 말씀 하나를 집중해서 연습합니다.</p>
      <button className="primary-button" onClick={startPractice}>연습 시작 <span>→</span></button>
    </div>
  );

  const testContent = testConfigured ? (
    <>
      <div className="test-card">
        <div className="test-meta"><span>QUESTION {testIndex + 1} / {testIds.length}</span><button onClick={() => { setTestConfigured(false); setSubmitted(false); setAnswer(""); setSelectedOption(""); }}>설정으로 돌아가기</button></div>
        {testType === "write" && <><p className="prompt-label">다음 장절의 말씀을 모두 입력하세요.</p><p className="reference-big">{testVerse.reference}</p></>}
        {testType === "reference" && <><p className="prompt-label">이 말씀의 장절을 선택하세요.</p><p className="quote-prompt">“<VerseLines lines={testVerse.lines} />”</p><div className="reference-options">{referenceOptions.map((option) => <button key={option} className={submitted && option === selectedOption ? (isReferenceCorrect ? "selected correct" : "selected wrong") : ""} onClick={() => { setSelectedOption(option); setSubmitted(true); }}>{option}</button>)}</div></>}
        {testType !== "reference" && <textarea value={answer} onChange={(event) => { setAnswer(event.target.value); setSubmitted(false); }} placeholder="여기에 답을 입력하세요" aria-label="시험 답안" />}
        {testType !== "reference" && <button className="submit-button" onClick={() => setSubmitted(true)}>비교하기 <span>→</span></button>}
      </div>
      {submitted && <div className="result-card"><p className="eyebrow">COMPARISON</p>{testType === "reference" ? <div className="comparison-view"><p><strong>원본</strong><span className="correct">{testVerse.reference}</span></p><p><strong>선택한 내용</strong><span className={isReferenceCorrect ? "correct" : "wrong"}>{selectedOption || "∅"}</span></p></div> : <ComparisonView expected={testVerse.lines.join(" ")} answer={answer} />}<p className="result-tip">원본과 작성한 내용을 어절 단위로 비교했습니다.</p>{testIndex < testIds.length - 1 && <button className="submit-button next-question" onClick={nextTestQuestion}>다음 문제 <span>→</span></button>}</div>}
    </>
  ) : (
    <div className="test-setup">
      <div className="setup-block"><p className="setup-label">시험 유형</p><div className="test-types">{(Object.keys(testLabels) as TestType[]).map((type) => <button key={type} className={testType === type ? "active" : ""} onClick={() => setTestType(type)}>{testLabels[type]}</button>)}</div></div>
      <div className="test-selection-mode"><p className="setup-label">시험 구절 설정</p><div className="test-types"><button className={testSelectionMode === "selected" ? "active" : ""} onClick={() => setTestSelectionMode("selected")}>여러 구절 선택</button><button className={testSelectionMode === "range" ? "active" : ""} onClick={() => setTestSelectionMode("range")}>범위로 선택</button></div></div>
      {testSelectionMode === "selected" ? <div className="verse-checkboxes">{verses.map((verse) => <label key={verse.id}><input type="checkbox" checked={selectedTestIds.includes(verse.id)} onChange={() => toggleTestId(verse.id)} /><span>{verse.id}번 · {verse.reference}</span></label>)}</div> : <div className="range-selects"><label className="verse-select-label">시작<select value={testRangeStart} onChange={(event) => setTestRangeStart(Number(event.target.value))}>{verses.map((verse) => <option key={verse.id} value={verse.id}>{verse.id}번</option>)}</select></label><label className="verse-select-label">끝<select value={testRangeEnd} onChange={(event) => setTestRangeEnd(Number(event.target.value))}>{verses.map((verse) => <option key={verse.id} value={verse.id}>{verse.id}번</option>)}</select></label></div>}
      <button className="primary-button setup-start" disabled={testSelectionMode === "selected" && selectedTestIds.length === 0} onClick={startTest}>시험 시작 <span>→</span></button>
    </div>
  );

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand-mark"><strong>교회 암송대회</strong></div><nav className="mode-tabs" aria-label="학습 모드">{(["library", "practice", "test"] as View[]).map((item, index) => <button key={item} className={view === item ? "active" : ""} onClick={() => selectView(item)}><span className="tab-number">0{index + 1}</span>{item === "library" ? "구절 보기" : item === "practice" ? "연습" : "시험"}</button>)}</nav></header>
      <div className="content-grid"><section className="main-panel">
        {view === "library" && <><div className="section-heading"><div><p className="eyebrow">COLLECTION</p><h2>암송 구절</h2></div><span className="count-label">총 {verses.length}개</span></div><div className="verse-list">{pageVerses.map((verse) => <button key={verse.id} className="verse-row" onClick={() => { setSelectedId(verse.id); setVerseModalOpen(true); }}><span className="verse-index">{String(verse.id).padStart(2, "0")}</span><span className="verse-content"><strong>{verse.reference}</strong><VerseLines lines={verse.lines} /></span><span className="arrow">↗</span></button>)}</div><div className="pagination"><button aria-label="이전 페이지" disabled={page === 1} onClick={() => setPage(page - 1)}>←</button><span>{page} <i>/</i> {totalPages}</span><button aria-label="다음 페이지" disabled={page === totalPages} onClick={() => setPage(page + 1)}>→</button></div></>}
        {view === "practice" && <><div className="section-heading"><div><p className="eyebrow">REHEARSAL ROOM</p><h2>{practiceStarted ? "타이핑 연습" : "연습 설정"}</h2></div><span className="count-label">{practiceStarted ? `${selectedVerse.id}번 말씀` : "말씀 하나를 선택"}</span></div>{practiceContent}</>}
        {view === "test" && <><div className="section-heading"><div><p className="eyebrow">THE MEMORY TEST</p><h2>{testConfigured ? "암송 시험" : "시험 설정"}</h2></div><span className="count-label">{testConfigured ? `${testIndex + 1} / ${testIds.length} 문제` : "시험 유형과 구절 선택"}</span></div>{testContent}</>}
      </section></div>
      {verseModalOpen && <div className="verse-modal-backdrop" role="presentation" onClick={() => setVerseModalOpen(false)}><section className="verse-modal" role="dialog" aria-modal="true" aria-labelledby="verse-modal-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><span className="eyebrow">VERSE {String(selectedVerse.id).padStart(2, "0")} / {verses.length}</span><button className="modal-close" aria-label="모달 닫기" onClick={() => setVerseModalOpen(false)}>×</button></div><p className="modal-reference" id="verse-modal-title">{selectedVerse.reference}</p><p className="modal-text"><VerseLines lines={selectedVerse.lines} /></p><div className="modal-navigation"><button disabled={selectedVerse.id === 1} onClick={() => setSelectedId(selectedVerse.id - 1)}>← 이전 구절</button><button disabled={selectedVerse.id === verses.length} onClick={() => setSelectedId(selectedVerse.id + 1)}>다음 구절 →</button></div></section></div>}
    </main>
  );
}
