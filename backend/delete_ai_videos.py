#!/usr/bin/env python3
"""
Script to check and delete AI-generated videos from the database
"""

import pymysql
import sys

# Database connection details
DB_HOST = "kiosk-db.cj0k46yy6vv6.ap-northeast-2.rds.amazonaws.com"
DB_USER = "admin"
DB_PASSWORD = "aioztesting"
DB_NAME = "kioskdb"

def main():
    try:
        # Connect to database
        print(f"Connecting to database {DB_NAME}...")
        connection = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )

        with connection:
            with connection.cursor() as cursor:
                # Check count of AI generated videos
                print("\n=== Checking AI Generated Videos ===")
                sql = """
                    SELECT COUNT(*) as count, video_type
                    FROM videos
                    WHERE video_type IN ('RUNWAY_GENERATED', 'AI_GENERATED', 'VEO_GENERATED')
                    GROUP BY video_type
                """
                cursor.execute(sql)
                results = cursor.fetchall()

                if not results:
                    print("No AI generated videos found.")
                    return

                total_count = 0
                for row in results:
                    print(f"  {row['video_type']}: {row['count']} videos")
                    total_count += row['count']

                print(f"\nTotal AI generated videos: {total_count}")

                # Show details
                print("\n=== Video Details ===")
                sql = """
                    SELECT id, title, video_type, media_type, original_filename, uploaded_at
                    FROM videos
                    WHERE video_type IN ('RUNWAY_GENERATED', 'AI_GENERATED', 'VEO_GENERATED')
                    ORDER BY id
                """
                cursor.execute(sql)
                videos = cursor.fetchall()

                for video in videos:
                    print(f"  ID: {video['id']}, Type: {video['video_type']}, Title: {video['title']}, File: {video['original_filename']}")

                # Confirm deletion
                print(f"\n=== Proceeding to delete {total_count} AI generated videos ===")

                if True:
                    # Delete AI generated videos
                    sql = """
                        DELETE FROM videos
                        WHERE video_type IN ('RUNWAY_GENERATED', 'AI_GENERATED', 'VEO_GENERATED')
                    """
                    cursor.execute(sql)
                    connection.commit()

                    deleted_count = cursor.rowcount
                    print(f"\n[SUCCESS] Successfully deleted {deleted_count} AI generated videos")

                    # Verify deletion
                    sql = """
                        SELECT COUNT(*) as count
                        FROM videos
                        WHERE video_type IN ('RUNWAY_GENERATED', 'AI_GENERATED', 'VEO_GENERATED')
                    """
                    cursor.execute(sql)
                    result = cursor.fetchone()
                    print(f"Remaining AI generated videos: {result['count']}")
                else:
                    print("\n[CANCELLED] Deletion cancelled")

    except pymysql.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
