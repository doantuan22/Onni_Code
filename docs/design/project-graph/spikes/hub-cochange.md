# S5 — Lưới ngưỡng hub và co-change

Đo ngày **2026-11-13**, HEAD `86c3c94`, Windows 11, Node `v24.21.0`. Chạy lại:

```bash
node docs/design/project-graph/scripts/hub-cochange/sweep.mjs > "$TEMP/hub-cochange.json"
```

Script gọi lại một lượt `scripts/replay/replay.mjs` có cache blob R1, không sửa `proto/lib.mjs`; kết quả cấu hình đầy đủ được in thành JSON. Thời gian lượt đo: **45 s** (cache nóng; R1 dựng graph từ cache). Dataset là 479 commit không merge, khoảng 15 ngày; chia theo thứ tự thời gian 70/30 (**335 train, 144 validation**). Bộ lọc R1 chỉ chấm commit có parent, code seed đã có ở parent và có file sự thật; vì vậy `n` trong bảng là số protocol-A mẫu được chấm, không phải tổng commit của split. Các metric là macro trung bình theo commit; kích thước là median/p90 số mục dự đoán. Không có bootstrap CI trong sweep.

## Định nghĩa và giao thức

- **Dependent của file F**: file nguồn phân biệt có ít nhất một cạnh hướng vào F trong graph tại parent commit, sau khi gộp nhiều import từ cùng file nguồn. Cạnh được extractor phân loại là `import`, `type`, `reexport`, `dynamic`, `require` hoặc `mock`. “Có phụ thuộc” ở đây chỉ là quan hệ cú pháp đã trích xuất, không khẳng định thay đổi F làm file đó lỗi.
- **Khuyến nghị cho ngưỡng hub**: đếm dependent là file production không-test, giữ loại cạnh hiện tại nhưng loại file nguồn test, bao gồm `vi.mock` nếu có. Báo thêm tổng số có test để thấy độ chênh; không dùng test làm tăng degree hub vì test suite có thể tạo hub giả. Số kiểm tra ở HEAD này cho `packages/work/src/runs/store.ts`: tổng **249** (55 non-test + 194 test), non-test **55**, cạnh `mock` đến file này **0**. PLAN §2.1 ghi xấp xỉ **62**, prototype cũ ghi **249**; chênh lệch 62/55 cần xem là khác snapshot/quy ước và không được âm thầm coi là tương đương.
- Hub grid: percentile p90/p95/p99 của in-degree × degree tối thiểu 10/20/40. Để tương thích prototype, độ degree trong lưới hiện đếm tất cả file nguồn (bao gồm test và `mock`) và dùng `hubThreshold` hiện hành. Vì vậy bảng là kết quả lặp lại theo prototype; đề nghị phía trên (degree chỉ production) là quyết định cấu hình cho E1 cần khóa và đo lại.
- Co-change: dự đoán partner B nếu weighted support `A∩B` đạt 2/3/5 và confidence `support(A∩B)/support(A)` đạt 0.2/0.3/0.5. Với decay, mỗi commit trước được trọng số `2^(-ageDays/halfLife)` tại thời điểm commit đang chấm; support và confidence đều dùng trọng số. Code→test và code→config tách riêng hoặc cho qua. Bot/noise subject, lockfile, denied path theo R1 bị loại. Ngưỡng kích thước commit là p90/p95/p99 của các commit usable trước điểm chấm, sau bộ lọc bot/lockfile, không cắt trên 30 file trước khi lấy percentile.
- Co-change precision/recall đo trên cùng truth impact protocol A của R1 (một seed code, các file code khác đổi cùng commit; file mới không thể dự đoán ở parent nên bị loại). LX edges là số file co-change dự đoán duy nhất; import overlap là phần trăm LX file cũng có trong tập direct-import dependents L1 thô. Kích thước ghi median/p90 LX file. Đây là đánh giá đồng đổi file, không phải nhãn lỗi hay xung đột.

## Hub — protocol A, gom nhóm hub

`P/R` là precision/recall impact; `n` là kích thước mục sau khi gộp hub directory; `impact p50/p90` là trung bình theo mẫu của p50/p90 số dependent trên các hub. `Hub p50` là số hub ở graph snapshot trung vị. Train n=117, validation n=42.

| Percentile × min degree | Train: cutoff / hub p50 | Train P/R | Train n med/p90 | Train impact p50/p90 | Val: cutoff / hub p50 | Val P/R | Val n med/p90 | Val impact p50/p90 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| p90 × 10 | 12 / 82 | 17.5% / 10.8% | 3 / 10 | 17 / 114 | 13 / 90 | 19.8% / 12.9% | 2 / 16 | 19 / 113 |
| p90 × 20 | 20 / 33 | 17.4% / 11.6% | 3 / 10 | 44 / 193 | 20 / 42 | 19.8% / 12.9% | 2 / 16 | 45 / 204 |
| p90 × 40 | 40 / 19 | 17.3% / 12.3% | 3 / 10 | 104 / 212 | 40 / 25 | 19.4% / 16.4% | 2 / 16 | 89 / 244 |
| p95 × 10 | 18 / 42 | 17.4% / 11.6% | 3 / 10 | 37 / 186 | 19 / 46 | 19.8% / 12.9% | 2 / 16 | 40 / 185 |
| p95 × 20 | 20 / 33 | 17.4% / 11.6% | 3 / 10 | 44 / 193 | 20 / 42 | 19.8% / 12.9% | 2 / 16 | 45 / 204 |
| p95 × 40 | 40 / 19 | 17.3% / 12.3% | 3 / 10 | 104 / 212 | 40 / 25 | 19.4% / 16.4% | 2 / 16 | 89 / 244 |
| p99 × 10 | 118 / 8 | 16.4% / 14.8% | 2 / 11 | 180 / 407 | 125 / 9 | 19.4% / 16.4% | 2 / 16 | 182 / 320 |
| p99 × 20 | 118 / 8 | 16.4% / 14.8% | 2 / 11 | 180 / 407 | 125 / 9 | 19.4% / 16.4% | 2 / 16 | 182 / 320 |
| p99 × 40 | 118 / 8 | 16.4% / 14.8% | 2 / 11 | 180 / 407 | 125 / 9 | 19.4% / 16.4% | 2 / 16 | 182 / 320 |

Trong giao thức này nâng cutoff chủ yếu tăng recall vài điểm nhưng làm impact p90 tăng mạnh; nhiều hàng trùng nhau vì percentile đã cao hơn mức tối thiểu. p95×20 là điểm ổn định quanh cả hai split, nhưng đây chưa phải kết quả của định nghĩa production-only được đề xuất.

## Co-change — support/confidence tại p95, không decay, tách test và config

Mỗi ô là `precision / recall; median/p90 số LX file; % LX trùng L1`. Train n=117, validation n=42 ở từng cấu hình.

| Support | Confidence 0.2 | Confidence 0.3 | Confidence 0.5 |
|---:|---|---|---|
| **Train 2** | 28.0% / 22.4%; 0 / 11; 13.5% | 32.2% / 16.0%; 0 / 8; 8.9% | 44.4% / 14.1%; 0 / 6; 8.9% |
| **Train 3** | 32.1% / 15.4%; 0 / 5; 7.5% | 37.2% / 9.2%; 0 / 5; 3.0% | 54.5% / 8.8%; 0 / 4; 3.0% |
| **Train 5** | 34.3% / 11.3%; 0 / 4; 5.1% | 44.8% / 5.3%; 0 / 1; 0.6% | 65.2% / 5.3%; 0 / 0; 0.6% |
| **Validation 2** | 7.0% / 6.6%; 0 / 7; 12.4% | 10.3% / 6.6%; 0 / 5; 13.8% | 11.6% / 5.7%; 0 / 3; 14.0% |
| **Validation 3** | 9.2% / 5.4%; 0 / 4; 7.0% | 11.8% / 5.4%; 0 / 3; 7.7% | 16.8% / 5.4%; 0 / 2; 9.0% |
| **Validation 5** | 20.8% / 2.4%; 0 / 0; 4.4% | 20.8% / 2.4%; 0 / 0; 4.4% | 20.8% / 2.4%; 0 / 0; 5.6% |

### Độ nhạy theo cap, decay và tách vai trò

Cap thay đổi theo prefix lịch sử; cột cap cho biết median/p90 số file tối đa cho phép của mỗi điểm chấm. `s3/c0.3` giữ nguyên; các ô còn lại là precision/recall, median/p90 tập và import overlap.

| Split | Cap percentile (median/p90 maxFiles) | P/R | LX median/p90 | Import overlap |
|---|---|---:|---:|---:|
| Train | p90 (37 / 590) | 26.6% / 10.7% | 0 / 7 | 3.9% |
| Train | p95 (165 / 927) | 23.2% / 13.9% | 0 / 8 | 8.3% |
| Train | p99 (923 / 1,234) | 13.5% / 28.9% | 3 / 109 | 10.3% |
| Validation | p90 (19 / 21) | 11.8% / 5.4% | 0 / 3 | 7.7% |
| Validation | p95 (33 / 37) | 7.0% / 5.4% | 0 / 4 | 8.6% |
| Validation | p99 (781 / 781) | 4.2% / 6.4% | 1 / 20 | 22.9% |

| Split (p95, s3/c0.3) | Không decay | 90 ngày | 180 ngày |
|---|---|---|---|
| Train P/R; LX p50/p90 | 23.2% / 13.9%; 0 / 8 | 25.5% / 8.6%; 0 / 6 | 25.5% / 8.6%; 0 / 6 |
| Validation P/R; LX p50/p90 | 7.0% / 5.4%; 0 / 4 | 6.8% / 3.0%; 0 / 3 | 6.8% / 3.0%; 0 / 3 |

| Split (p95, no decay, s3/c0.3) | Cho code↔test | Cho code↔config | P/R | LX p50/p90 |
|---|---|---|---:|---:|
| Train | Có | Có | 23.2% / 13.9% | 0 / 8 |
| Train | Không | Có | 23.1% / 13.9% | 0 / 8 |
| Train | Có | Không | 23.2% / 13.9% | 0 / 8 |
| Train | Không | Không | 17.6% / 13.9% | 0 / 13 |
| Validation | Có | Có | 7.0% / 5.4% | 0 / 4 |
| Validation | Không | Có | 7.0% / 5.4% | 0 / 4 |
| Validation | Có | Không | 7.0% / 5.4% | 0 / 4 |
| Validation | Không | Không | 2.3% / 5.4% | 0 / 6 |

## Đề xuất cho E1 (P1) và kết luận

- **Hub:** khởi điểm p95 × min degree 20. Nó trùng cutoff 20 trên cả hai split, giảm hub population còn median 33 train / 42 validation thay vì 82 / 90 với p90×10; precision gần như ngang nhau và kích thước nhóm ổn định. Áp dụng cutoff trên production-only dependents (không-test, có thể gồm mock edges) khi chốt implementation; cần đo lại con số vì lưới hiện dùng định nghĩa prototype gồm test.
- **Co-change:** chỉ giữ làm soft edge/thông tin; không dispatch gate. Nếu cần preset thử cho E1, chọn `support≥3`, `confidence≥0.3`, **không decay**, tách code↔test và code↔config, bot/lockfile loại, cap p95. Mức này cho train P/R 23.2%/13.9%, validation 7.0%/5.4%, median LX rỗng ở cả hai split, p90 8/4. Không có chất lượng validation đủ để nâng độ tin cậy.
- **Độ nhạy cao:** p99 cho phép các commit hàng trăm/hàng nghìn file, làm p90 LX tăng tới 109 train; confidence/support thay nhẹ khiến precision/recall đổi đáng kể. Cap p90/p95/p99 đang được tính từ các commit usable trước từng điểm; train p99 có p90 maxFiles 1,234. Cần thêm cap tuyệt đối nếu E1 tiêu thụ trực tuyến, và không tối ưu theo một con số duy nhất của validation.
- Decay 90/180 ngày gần như trùng nhau vì lịch sử chỉ 15 ngày; chưa có bằng chứng để bật decay. Tách test làm giảm kích thước và tăng precision; tách config không làm thay đổi đáng kể trong mẫu này. Co-change overlap L1 thấp (3–14% tại các cấu hình p95), nên phần lớn edges là tín hiệu bổ sung thực sự, nhưng vẫn yếu.
- Hạn chế: cùng một repo/thời kỳ, commit không độc lập, impact truth là file đồng sửa chứ không phải nhãn phụ thuộc/nguyên nhân; macro trung bình và không CI; cap percentile có phân phối đuôi rất nặng. Đây là spike tham số, không phải bằng chứng đủ để dùng LX lọc test hay cản dispatch.
