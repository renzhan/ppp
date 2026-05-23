# Implementation Plan: Review Page Redesign

## Overview

Simplify the ppp_pi review page layout (remove toolbar, right sidebar, center panel) and load the presenton iframe directly. In presenton, replace the slide thumbnails side panel with a ChapterDirectory component and add Chinese localization. Wire up postMessage communication for module-to-chapter navigation.

## Tasks

- [x] 1. Simplify ppp_pi review page layout
  - [x] 1.1 Remove ReviewToolbar, AIChatPanel, right sidebar, and CenterPanel from the review page
    - Remove the `ReviewToolbar` component rendering and its related state/props (`currentTone`, `onToneChange`, `onExport`, `onFinalize`, `columnVisibility`, etc.)
    - Remove the right sidebar container, tab switching logic (`rightPanelOpen`, `rightPanelTab` state), `AIChatPanel`, and `PptPanel` sidebar mode
    - Remove the `CenterPanel` component rendering and its related state
    - Keep `ModuleNavTree` and `leftPanelOpen` state intact
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 4.2_

  - [x] 1.2 Render presenton iframe directly in the main content area
    - When `presentationId` is available, render an iframe with `src={PRESENTON_BASE_URL}/presentation?id=${presentationId}&locale=zh`
    - The iframe should occupy full width (right of left nav) and full remaining height
    - When no `presentationId` is available, display a "generate PPT" prompt
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 Simplify PptPanel component
    - Remove the `fullWidth` toolbar (the `<div>` containing "下载 PPTX" and "重新生成" buttons)
    - Simplify the component interface to `{ presentationId?, onGenerate?, isGenerating? }`
    - The component should only handle the "no PPT" prompt state; the iframe is rendered by the page directly
    - _Requirements: 1.1, 1.3, 2.4_

  - [x] 1.4 Implement postMessage sending from ModuleNavTree
    - When a module is selected in `ModuleNavTree`, send a `postMessage` to the presenton iframe with `{ type: 'NAVIGATE_TO_CHAPTER', moduleId }` 
    - Maintain a `MODULE_TO_CHAPTER` mapping (M1→data-overview, M2→bg, M3→highlights, etc.)
    - Use an iframe ref to target the message
    - _Requirements: 4.3_

- [x] 2. Checkpoint - Verify ppp_pi changes compile and render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create ChapterDirectory component in presenton
  - [x] 3.1 Create the ChapterDirectory component
    - Create `presenton/servers/nextjs/app/(presentation-generator)/presentation/components/ChapterDirectory.tsx`
    - Implement the `Chapter` interface with `id`, `name`, `slideIndices`, `children?`
    - Implement `ChapterDirectoryProps` with `chapters`, `currentSlideIndex`, `onChapterClick`
    - Display chapters in the fixed order: 项目背景 (with sub-chapters 传播目的, 策略回顾), 数据总揽, 项目亮点, 综合分析, 内容分析, 人群资产分析, 投流分析, 竞品分析, 优化建议
    - Support hierarchical display with parent/child indentation
    - Highlight the chapter corresponding to the current slide
    - Clicking a chapter calls `onChapterClick` with the first slide index of that chapter
    - Disable/grey out chapters with no mapped slides
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 3.2 Implement chapter-slide mapping logic
    - Define `CHAPTER_CONFIG` constant with the fixed chapter structure
    - Implement `buildChapterSlideMap` function that reads slide metadata `chapterId` and populates `slideIndices`
    - _Requirements: 6.1_

  - [x] 3.3 Write unit tests for ChapterDirectory
    - Test that chapters render in the correct fixed order
    - Test that clicking a chapter triggers `onChapterClick` with correct slide index
    - Test that current slide highlights the correct chapter
    - Test parent chapter expand/collapse behavior
    - _Requirements: 5.1, 5.3, 5.4, 6.1, 6.3_

- [x] 4. Modify presenton SidePanel to use ChapterDirectory
  - [x] 4.1 Replace slide thumbnails with ChapterDirectory in SidePanel
    - Import and render `ChapterDirectory` instead of the existing slide thumbnail list
    - Pass current slide index and chapter click handler
    - Keep the "添加幻灯片" button (update label to Chinese)
    - Wire `onChapterClick` to the editor's slide navigation (scroll to slide)
    - _Requirements: 5.1, 5.3, 7.2_

  - [x] 4.2 Implement postMessage listener for NAVIGATE_TO_CHAPTER
    - Add a `message` event listener in the presenton presentation page
    - When receiving `{ type: 'NAVIGATE_TO_CHAPTER', moduleId }`, map `moduleId` to `chapterId` and scroll to the first slide of that chapter
    - _Requirements: 4.3, 5.3_

- [x] 5. Implement Chinese localization in presenton
  - [x] 5.1 Create Chinese locale file
    - Create `presenton/servers/nextjs/utils/locales/zh.ts` with all UI strings in Chinese (addSlide: '添加幻灯片', loading: '加载中...', error: '加载失败', retry: '重试', etc.)
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 5.2 Implement locale context and URL parameter detection
    - Read `locale` query parameter from the URL (default to English if absent)
    - Create a React Context to provide locale strings to all components
    - Apply Chinese locale when `locale=zh` is passed
    - _Requirements: 7.1, 7.3_

  - [x] 5.3 Apply locale strings to presenton UI components
    - Replace hardcoded English strings in SidePanel, editor controls, error/loading states with locale-aware strings from context
    - _Requirements: 7.1, 7.2, 7.4_

- [x] 6. Final checkpoint - Ensure all changes compile and integrate correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature spans two projects: ppp_pi (review page) and presenton (editor)
- The design uses TypeScript/React throughout
- PBT is not applicable for this feature (UI layout changes)
- Each task references specific requirements for traceability
