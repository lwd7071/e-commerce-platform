# NHIỆM VỤ: CHUẨN HÓA ĐỊNH DẠNG BÁO CÁO / KHÓA LUẬN (DOCX)

## 0. Nguyên tắc chung

Các nguyên tắc dưới đây áp dụng cho toàn bộ nhiệm vụ. Các mục sau không nhắc lại.

1. **Bảo toàn nội dung.** Không viết lại, lược bỏ, rút gọn hay bổ sung nội dung học thuật, số liệu, công thức, hình, bảng, biểu đồ, nguồn trích dẫn.
2. **Làm trên bản sao.** Không ghi đè file gốc. Lưu kết quả thành file mới (ví dụ `<tên>_formatted.docx`).
3. **Không bịa.** Không tự đặt tên hình/bảng, không tự sửa số thứ tự hay thông tin tài liệu tham khảo khi thiếu căn cứ. Ghi nhận vào báo cáo để người dùng xác nhận.
4. **Ưu tiên cơ chế gốc của Word:** Styles, Multilevel List, Caption, Field, Section, Paragraph Border. Không tìm-và-thay thế hàng loạt thiếu kiểm soát.
5. **Giữ định dạng có ý nghĩa:** công thức, chỉ số trên/dưới, ký hiệu khoa học, đoạn mã, chữ đậm/nghiêng nhấn mạnh trong đoạn văn.
6. **Trung thực khi báo cáo.** Không tuyên bố đã tạo trường tự động nếu thực tế là văn bản tĩnh. Không tuyên bố đã kiểm tra PDF nếu chưa xuất và xem PDF. Không tuyên bố số trang đã đúng nếu chưa đối chiếu.
7. **Khi gặp giới hạn kỹ thuật:** nêu rõ giới hạn, làm phần có thể làm an toàn, không làm hỏng tài liệu.

## 1. Kiểm kê trước khi sửa (bắt buộc, chưa chỉnh gì)

1. Xác định loại file và công cụ khả dụng. DOCX: chỉnh trực tiếp XML. Markdown hoặc định dạng khác: chuyển sang DOCX bằng quy trình phù hợp, không giả định Markdown thuần tạo được Header, Footer, mục lục tự động.
2. Lập danh sách: Styles đang dùng, Section, Header/Footer (và liên kết giữa các Section), Page/Section Break, bảng, hình, caption, danh sách (bullet/số), trường (field) hiện có, tài liệu tham khảo.
3. Quét các lỗi thường gặp sau nhiều lần chỉnh bằng công cụ:
   - Direct formatting (font, cỡ chữ, giãn dòng) đè lên Style.
   - Tiêu đề giả (chỉ in đậm, không dùng Heading); số thứ tự tiêu đề gõ tay.
   - Mục lục, danh mục, số trang gõ tay; đường kẻ giả bằng ký tự gạch ngang.
   - Dòng trống/dấu cách/Tab dùng để căn lề hoặc tạo khoảng cách.
   - Page Break, Section Break thừa; tiêu đề rỗng; trang trắng.
   - Bullet gõ tay (`-`, `–`, `•`) lẫn với bullet tự động nhiều kiểu.
   - Style trùng/không dùng; font nhúng làm nặng file; tracked changes, comment, bookmark sót.
   - Bảng tràn lề, cột quá hẹp làm vỡ từ.
4. Xuất báo cáo kiểm kê ngắn (số liệu, ví dụ, mức độ) và các điểm cần người dùng xác nhận **trước khi sửa**.

## 2. Khổ giấy, lề, đoạn văn

| Thông số | Giá trị |
|---|---|
| Khổ giấy / hướng | A4, dọc |
| Lề | Trên 2 cm, dưới 2 cm, trái 3 cm, phải 2 cm |
| Vùng chữ | 16 cm (9071 twips) |
| Header / Footer cách mép giấy | khoảng 0,9 cm (giữ giá trị hiện có nếu đã nhất quán) |
| Font | Times New Roman, Unicode |
| Giãn dòng nội dung | 1.5 lines |
| Căn đoạn văn | Đều hai bên (justify) |
| Thụt đầu dòng đoạn văn *(đề xuất)* | 1 cm |
| Khoảng cách đoạn *(đề xuất)* | Before 0, After 6 pt |
| Kiểm soát trang | Bật widow/orphan control |

Không thay đổi khổ giấy/lề của phần đặc biệt nếu tài liệu có yêu cầu riêng rõ ràng. Các thông số ghi *(đề xuất)* chỉ áp dụng khi tài liệu chưa có quy định; nếu file đã có giá trị nhất quán thì giữ nguyên.

## 3. Styles: font và tiêu đề

| Thành phần | Style Word | Cỡ | Định dạng | Căn |
|---|---|---:|---|---|
| Tên chương | Heading 1 | 14 | **IN HOA, đậm** | Giữa |
| Mục cấp 1 (1.1) | Heading 2 | 13 | Chữ thường, đậm | Trái |
| Mục cấp 2 (1.1.1) | Heading 3 | 13 | Chữ thường, đậm + nghiêng | Trái |
| Mục cấp 3 (1.1.1.1), nếu cần | Heading 4 | 13 | Chữ thường, nghiêng | Trái |
| Nội dung chính | Normal | 13 | Bình thường | Đều hai bên |
| Tiêu đề phần đầu (Lời cảm ơn, Mục lục, Danh mục...) | Style riêng, **không vào mục lục** | 14 | IN HOA, đậm | Giữa |
| Tiêu đề không đánh số, có vào mục lục (Tài liệu tham khảo, Phụ lục...) | Style riêng, Outline Level 1 | 14 | IN HOA, đậm | Giữa |
| Nội dung bảng | Style bảng | 12 | Bình thường | Theo cột (mục 9) |
| Tên bảng | Caption | 11 | Đậm | Giữa, **phía trên** bảng |
| Chú thích bảng / nguồn | Style riêng | 10 | Nghiêng | Giữa, phía dưới bảng |
| Tên hình | Caption | 11 | Đậm | Giữa, **phía dưới** hình |
| Tài liệu tham khảo | Style riêng | 11 | Bình thường | Trái |
| Khối mã nguồn | Style `Code` | 10 | Consolas hoặc Courier New, giãn dòng 1.0, nền xám nhạt | Trái |
| Header / Footer | Header / Footer | 11 | Bình thường | Xem mục 5, 6 |

Quy tắc viết hoa tiêu đề: **chỉ tên chương IN HOA**. Từ mục cấp 1 trở xuống viết như câu: chỉ hoa chữ cái đầu và tên riêng/thuật ngữ (ví dụ PayOS, Flash Sale, Supabase). Không hạ chữ thường hàng loạt bằng tìm-và-thay; xuất danh sách tiêu đề **trước/sau** để người dùng duyệt.

Yêu cầu bổ sung:
- Nhận diện cấp tiêu đề theo số thứ tự, cấu trúc và quan hệ giữa các mục. Không suy đoán từ việc đoạn văn in đậm hay nằm đầu trang.
- Giữ nguyên nội dung tiêu đề. Không áp định dạng tiêu đề cho đoạn văn thường.
- Mọi Heading bật *Keep with next*. Heading 1 bật *Page break before*.
- Không dùng Heading để tạo định dạng cho đoạn không phải tiêu đề.

## 4. Hệ thống đánh số chương và mục

- Dùng số Ả Rập, hệ phân cấp `1`, `1.1`, `1.1.1`, `1.1.1.1` (cấp 4 chỉ khi thật cần).
- **Dùng Multilevel List liên kết Heading 1–3 (hoặc 4).** Số thứ tự do Word sinh tự động, không gõ tay trong nội dung tiêu đề.
  - Heading 1: `CHƯƠNG %1.` Heading 2: `%1.%2.` Heading 3: `%1.%2.%3.`
- Tiêu đề không đánh số (Tài liệu tham khảo, Phụ lục, Lời cảm ơn...) dùng style riêng ở mục 3, không tham gia danh sách số.
- Phát hiện và báo cáo: trùng số, thiếu số, nhảy số, sai cấp, tiêu đề chương thiếu tiền tố "CHƯƠNG", tiêu đề rỗng.
- Chỉ sửa số khi có đủ căn cứ từ cấu trúc. Nếu không đủ căn cứ, ghi vào báo cáo để người dùng xác nhận.
- Khi di chuyển, gộp hoặc đổi số mục: cập nhật Caption, mục lục, và **quét các tham chiếu gõ tay** trong văn bản ("Bảng 3.2", "mục 4.1", "Hình 2.3") để sửa cho khớp.

## 5. Header (đầu trang)

**Phạm vi:** chỉ trang thuộc phần nội dung chính. **Không** áp Header tên chương cho: trang bìa, nhận xét, lời cảm ơn, mục lục, danh mục, phần mở đầu không đánh số, tài liệu tham khảo, phụ lục. Các phần này giữ bố cục riêng.

**Nội dung và cơ chế:**
- Tên chương bên trái, lấy tự động bằng `STYLEREF "Heading 1"`; không nhập thủ công, không cố định một tên cho cả tài liệu.
- Nếu số chương là số tự động, ghép hai trường: `{ STYLEREF "Heading 1" \n }` + dấu cách + `{ STYLEREF "Heading 1" }` để hiển thị đủ "CHƯƠNG 9. TÊN CHƯƠNG".
- Kiểm tra trang đầu chương, trang chuyển chương, trang giữa chương: Header chương mới không được hiện tên chương cũ.
- Cỡ chữ 11, bình thường.

**Đường kẻ:** Paragraph Border (dưới) mảnh 0.5 pt, màu đồng nhất giữa các Section. Không dùng chuỗi gạch ngang, không dùng hình vẽ riêng lẻ.

## 6. Footer (chân trang) và đánh số trang

- Số trang ở góc dưới bên phải bằng trường `PAGE`, cỡ 11. Không gõ tay, không đè lên nội dung.
- Đường kẻ ngang mảnh 0.5 pt phía trên Footer (Paragraph Border), đồng nhất độ dày, màu, vị trí.
- Số trang Ả Rập (1, 2, 3...). Kiểm tra liên tục giữa các Section, không tự quay về 1 ngoài ý muốn.
- **Quy tắc đánh số phần mở đầu:** giữ đúng cách đánh số hiện có của file (ví dụ trang bìa không hiện số, số trang liên tục toàn tài liệu). Nếu muốn đổi, người dùng phải ghi rõ ở mục "Tham số riêng" (cuối file). Không tự suy đoán.
- Kiểm tra *Different First Page*, *Different Odd & Even*, *Link to Previous* nếu ảnh hưởng đến Header/Footer.

## 7. Mục lục tự động

- Tạo bằng Table of Contents của Word (trường `TOC`), lấy Heading 1–3 (và 4 nếu dùng) cùng style không đánh số có Outline Level 1. Không gõ tay.
- Nếu đã có mục lục: chuẩn hóa mục lục hiện có, không tạo bản trùng.
- Hiển thị đúng số thứ tự, tên mục, số trang; dot leader; số trang căn thẳng ở lề phải; thụt lề phân cấp; mục dài không vỡ bố cục.
- Không đưa vào mục lục: chính tiêu đề "MỤC LỤC", "DANH MỤC HÌNH", "DANH MỤC BẢNG", Lời cảm ơn, Nhận xét, đoạn văn thường, tiêu đề rỗng.
- Liên kết nội bộ (`\h`) nhấp được và đúng vị trí.
- Bật `updateFields` trong `settings.xml` để Word hỏi cập nhật khi mở file. Số trang chính xác chỉ xác nhận được sau khi cập nhật trong Word hoặc đối chiếu PDF; nếu chưa làm được, **ghi rõ trong báo cáo**.

## 8. Caption, danh mục hình và danh mục bảng

**Caption** (Insert Caption, trường `SEQ`):
- Nhãn thống nhất: `Hình`, `Bảng`. Định dạng: `Hình 2.3. Tên hình`; số chương lấy từ số tự động của Heading 1.
- **Kiểm tra bắt buộc bằng PDF:** caption hiển thị `Bảng 9.1` chứ không phải `Bảng CHƯƠNG 9.1` hay `Bảng 9..1`. Nếu `STYLEREF`/`SEQ \s` trả về sai chuỗi do cấu hình số chương, xử lý lại cho đúng.
- Tên bảng ở trên bảng; tên hình ở dưới hình. Không kết thúc tên bằng dấu chấm; thống nhất cách viết giữa các caption.
- Giữ nguyên tên, mô tả, nguồn, chú thích. Hình/bảng chưa có tên: ghi nhận để xác nhận, không tự đặt.
- Bảng bố cục hoặc ảnh trang trí (logo, ảnh bìa) có thể không cần caption. **Liệt kê các bảng/hình không có caption** để người dùng quyết định.
- Caption bảng bật *Keep with next*; hình và caption hình không tách nhau (*Keep with next* cho đoạn chứa hình).

**Danh mục hình / danh mục bảng:**
- Dùng Insert Table of Figures theo nhãn `Hình` và `Bảng` (hai danh mục riêng, không lẫn nhau). Nếu đã có thì chuẩn hóa, không tạo bản trùng.
- Hiển thị số thứ tự, tên, số trang; dot leader; số trang căn phải; không tràn lề.
- Cập nhật được khi thêm/xóa/đổi tên/chuyển trang. Sau cập nhật, đối chiếu số trang với vị trí thực tế.

## 9. Bảng

**Giữ nguyên:** dữ liệu, cấu trúc hàng/cột, ô gộp, công thức, chú thích, nguồn, ký hiệu trong ô (`✓`, `–`...). Không chuyển bảng thành hình hay văn bản.

**Kích thước và bố cục (chống tràn lề, chống vỡ từ):**
1. Layout `fixed`; tổng độ rộng bảng không vượt vùng chữ (9071 twips ≈ 16 cm). Bảng rộng hơn phải co lại; bảng hẹp hơn có thể giữ nếu ít cột.
2. Đồng bộ `tblGrid` và `tcW` của mọi ô để Word không tự giãn cột.
3. **Cột STT:** cố định khoảng 1,2 cm (≈ 700 twips), căn giữa. Không để cột STT rộng hơn cần thiết.
4. **Cột mã** (ví dụ `TK_BM1`, `RB-KN04`, `TC-01`): vừa đủ cho mã dài nhất cộng lề ô, căn giữa.
5. **Cột còn lại:** độ rộng tối thiểu = từ dài nhất trong cột (ước lượng ≈ 105 twips/ký tự ở cỡ 12) + lề ô, để **không vỡ từ giữa chừng**. Phần rộng còn lại chia theo độ dài nội dung của cột (cột mô tả rộng hơn cột loại/trạng thái).
6. Chuỗi kỹ thuật rất dài (đường dẫn `/admin/categories`, tên `snake_case`): cho phép ngắt dòng tại `/`, `_`, `-` thay vì giữa chữ.
7. Nếu bảng nhiều cột vẫn quá chật: giảm lề ô trái/phải trước; chỉ giảm cỡ chữ của riêng bảng đó (tối thiểu 11) khi người dùng cho phép ở mục "Tham số riêng". Không xoay trang ngang trừ khi được yêu cầu.

**Căn chỉnh trong ô:** STT, mã, ngày, trạng thái: giữa. Văn bản: trái. Số liệu: phải hoặc theo quy ước sẵn có của bảng. Hàng tiêu đề đậm, căn giữa.

**Qua trang:** bật *Repeat Header Rows* cho bảng nhiều dòng; bật *Don't allow row to break across pages*; hạn chế chia bảng giữa hai trang; hàng tiêu đề không nằm một mình cuối trang.

## 10. Hình ảnh, biểu đồ, công thức

- Giữ nguyên hình, biểu đồ, dữ liệu gốc, nguồn trích dẫn. Không kéo giãn sai tỷ lệ; hình không vượt vùng chữ.
- Hình đặt gần đoạn liên quan; caption hình khớp với danh mục hình.
- Công thức: giữ nguyên nội dung, định dạng, chỉ số trên/dưới, ký hiệu, đơn vị.

## 11. Danh sách (bullet và số)

- **Một kiểu bullet duy nhất toàn tài liệu:** ❖ (Wingdings, ký tự `\uf076`), lấy theo kiểu đang dùng ở các chương đầu. Mọi cấp dùng cùng ký hiệu.
- **Một định nghĩa danh sách duy nhất** (một `abstractNum`), thụt lề thống nhất: cấp 1 left 0,63 cm / hanging 0,63 cm; cấp 2 left 1,27 cm; cấp 3 left 1,9 cm.
- Bullet khác kiểu (gạch Symbol, chấm tròn...) → đổi sang ❖. Bullet gõ tay ở đầu đoạn thân văn bản (`- `, `– `, `• `) → xóa ký tự gõ tay và chuyển thành danh sách tự động.
- **Không động đến** ký hiệu `–`, `✓`, `x` nằm trong ô bảng (là dữ liệu, không phải bullet).
- Danh sách số (`1.`, `2.`...) giữ nguyên là danh sách số; đổi font số sang Times New Roman nếu đang là Arial. Chữ trong danh sách dùng font và cỡ như nội dung chính.
- Mỗi danh sách số bắt đầu lại từ 1 khi là danh sách mới (không nối số giữa các danh sách khác nhau).

## 12. Tài liệu tham khảo

- Cỡ 11, Times New Roman, bình thường, căn trái.
- Giữ nguyên tên tác giả, tên bài/sách/tạp chí, năm, tập, số, trang, nhà xuất bản, đường dẫn. Không bịa thông tin thiếu, không xóa tài liệu.
- Không đổi thứ tự khi chưa rõ quy tắc sắp xếp; nếu quy định theo thứ tự từ điển thì kiểm tra trên danh sách hiện có trước.
- Kiểu trích dẫn (IEEE, APA...): theo kiểu hiện có trong tài liệu. Nếu không thống nhất, ghi nhận để xác nhận.
- Giữ liên kết trích dẫn trong nội dung. Tài liệu thiếu thông tin hoặc nghi trùng lặp: ghi vào báo cáo, không tự sửa.

## 13. Dọn định dạng thừa

Chỉ thực hiện **sau khi** đã báo cáo kiểm kê và được xác nhận:

1. Xóa direct formatting thừa ngoài bảng, thay bằng Style. Giữ định dạng có ý nghĩa (mục 0, điểm 5).
2. Xóa tiêu đề rỗng và đoạn trống dùng để tạo khoảng cách. **Giữ** đoạn trống đang mang Page Break, Section Break hoặc chứa hình.
3. Thay dòng trống/Tab căn lề bằng thụt lề, khoảng cách đoạn, tab stop.
4. Gộp/xóa Style trùng hoặc không dùng (không xóa Style của hệ thống).
5. Gỡ font nhúng nếu làm file nặng và font là font chuẩn có sẵn; báo cáo dung lượng trước/sau.
6. Xóa bookmark, comment, tracked changes sót chỉ khi người dùng đồng ý.

## 14. Phần đặc biệt, Section và phân trang

- Giữ nguyên cấu trúc trang bìa và phần mở đầu. Giữ Page Break/Section Break cần thiết.
- Chỉ thêm hoặc chỉnh Section khi cần để kiểm soát Header, Footer, số trang. Không làm mất nội dung Header/Footer khi tách Section.
- Không để mục lục, danh mục xuất hiện hai lần. Không để tiêu đề chương nằm riêng cuối trang. Không trang trắng bất thường.
- Sau khi áp font, lề, giãn dòng: kiểm tra lại toàn bộ phân trang.

## 15. Quy trình bắt buộc

1. **Kiểm kê** (mục 1) và báo cáo, chờ xác nhận các điểm mơ hồ.
2. **Bảo toàn bản gốc:** làm việc trên bản sao.
3. **Chuẩn hóa Styles** (mục 2, 3) và danh sách (mục 11).
4. **Đánh số tiêu đề** bằng Multilevel List (mục 4); xuất danh sách tiêu đề trước/sau để duyệt.
5. **Header/Footer** (mục 5, 6).
6. **Caption** (mục 8) và **bảng** (mục 9).
7. **Mục lục, danh mục hình, danh mục bảng** (mục 7, 8).
8. **Dọn định dạng thừa** (mục 13).
9. **Cập nhật trường**, xuất DOCX và PDF (qua Word hoặc LibreOffice). Đối chiếu mục lục và danh mục với số trang thực tế trong PDF; xem trực quan các trang đầu chương, trang có bảng lớn, trang có hình.
10. **Kiểm tra lần cuối:** file mở và chỉnh được trong Word; danh mục vẫn là trường tự động; nội dung không mất.

## 16. Tiêu chí nghiệm thu

1. A4 dọc, lề đúng; font, cỡ chữ, giãn dòng, căn chỉnh nhất quán.
2. Cấp tiêu đề đúng Style; số tiêu đề tự động; không trùng, không thiếu, không nhảy số.
3. Chỉ tên chương IN HOA; các cấp thấp hơn đúng quy tắc mục 3.
4. Header tên chương tự cập nhật đúng; đường kẻ Header và Footer đồng nhất.
5. Số trang tự động ở góc dưới bên phải, liên tục theo quy tắc đã chốt.
6. Mục lục, danh mục hình, danh mục bảng là trường tự động, cập nhật được, không trùng lặp.
7. Tên hình/bảng và số trang khớp vị trí thực tế; caption hiển thị đúng dạng `Bảng 9.1`.
8. Mọi bảng nằm trong vùng chữ, không vỡ từ giữa chừng; STT gọn; hàng tiêu đề lặp lại ở bảng qua trang.
9. Một kiểu bullet thống nhất; không còn bullet gõ tay trong thân văn bản.
10. Bảng, hình, công thức, trích dẫn, dữ liệu không bị mất hoặc đổi ngoài ý muốn.
11. Không có tiêu đề rỗng, trang trắng bất thường, lỗi phân trang nghiêm trọng chưa giải thích.
12. Bản gốc giữ nguyên; bản mới lưu riêng.

## 17. Yêu cầu đầu ra

1. File DOCX đã chuẩn hóa, tiếp tục chỉnh sửa được trong Word.
2. File PDF xuất để kiểm tra bố cục (nếu công cụ hỗ trợ).
3. Báo cáo ngắn các thay đổi, kèm số liệu trước/sau (số tiêu đề đã chuyển, bullet đã đổi, bảng đã chỉnh...).
4. Danh sách vấn đề còn tồn tại, mục chưa tự xử lý được, các điểm cần người dùng xác nhận (bảng/hình thiếu caption, tiêu đề đánh số bất thường, tham khảo thiếu thông tin...).
5. Nếu người dùng yêu cầu: bảng Excel/Markdown liệt kê lỗi theo mẫu `Nhóm | Vị trí | Mô tả | Cách xử lý | Trạng thái`.

**Bắt đầu bằng bước kiểm kê (mục 1), báo cáo kết quả và các điểm cần xác nhận, rồi mới chỉnh sửa.**

---

## Tham số riêng của tài liệu hiện tại (điền hoặc chỉnh trước khi chạy)

Phần này tách khỏi quy chuẩn chung để file dùng lại được cho tài liệu khác. Giá trị dưới đây là các quyết định đã chốt cho báo cáo hiện tại.

| Tham số | Giá trị |
|---|---|
| Chương 9 | "CHƯƠNG 9. CÀI ĐẶT VÀ KIỂM THỬ HỆ THỐNG" |
| Mục 9.4 | Tech stack đưa vào làm **9.4.1 Công nghệ sử dụng**; các mục 9.4.1, 9.4.2 cũ thành 9.4.2, 9.4.3; caption bảng Tech stack đánh số theo chương 9 |
| Chương 10 | "KẾT LUẬN" (mục con 10.1 – 10.4) |
| Không đánh số chương | Tài liệu tham khảo, Phụ lục, Bảng khối lượng công việc từng thành viên (có trong mục lục, không có Header tên chương) |
| Heading 2 trở xuống | Chữ thường (chỉ chương IN HOA); giữ tên riêng như PayOS, Flash Sale |
| Bullet | Một kiểu ❖ như mục 11 |
| Số trang phần mở đầu | Giữ như file hiện có (liên tục, bìa không hiện số) |
| Cỡ chữ tối thiểu trong bảng khi quá chật | 12 (chưa cho phép hạ xuống 11) *[sửa nếu muốn cho phép]* |
| Kiểu trích dẫn | Theo kiểu hiện có trong file |
