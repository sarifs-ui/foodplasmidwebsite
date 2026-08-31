import csv
from pathlib import Path

def csv_to_tsv(input_file, output_file):
    # Dosyaları aç (Türkçe karakter sorunu yaşamamak için utf-8 kullanıyoruz)
    with open(input_file, 'r', encoding='utf-8') as csv_in, \
         open(output_file, 'w', encoding='utf-8', newline='') as tsv_out:
        
        # CSV'yi standart olarak (virgül ile) oku
        csv_reader = csv.reader(csv_in)
        # TSV olarak (sekme - tab ile) yazmaya ayarla
        tsv_writer = csv.writer(tsv_out, delimiter='\t')
        
        # Tüm satırları dönüştürerek yeni dosyaya yaz
        for row in csv_reader:
            tsv_writer.writerow(row)

# Dönüşümü scriptin bulunduğu klasördeki dosyalar üzerinde yap.
data_dir = Path(__file__).resolve().parent
csv_to_tsv(data_dir / 'amr_rgi_consensus.csv', data_dir / 'amr_rgi_consensus.tsv')