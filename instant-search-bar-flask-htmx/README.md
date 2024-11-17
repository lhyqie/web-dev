Learn from How to Create an Instant Search Bar With Flask and HTMX: https://www.youtube.com/watch?v=PWEl1ysbPAY

Code:  https://github.com/PrettyPrinted/youtube_video_code/tree/master/2023/08/08/How%20to%20Create%20an%20Instant%20Search%20Bar%20With%20Flask%20and%20HTMX

To create database and populate data:

  1. Download from https://github.com/HipsterVizNinja/random-data/tree/main/Music/hot-100 and save as "data.csv"

  2. Run the following commandline to create db and populate data
      ```python 
        $ python
        $ from app import create_app
        $ create_app(populate_db=True)
      ```

  3. Run the following commandline to start web application
      ```python
         $ python app.py
      ```