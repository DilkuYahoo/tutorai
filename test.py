import mylib

ticker = "RRL.AX".rstrip()
analysis = 'sentiment '.rstrip()
if analysis == 'sentiment':
    headlines = "Running the analysis code"
else:
    headlines = "Running the sentiment code"

#stock_data = mylib.fetch_stock_data(ticker=ticker)
#headlines = mylib.fetch_news_headlines(ticker)
#output = mylib.analyze_stock_sentiment(headlines)

print (headlines)
