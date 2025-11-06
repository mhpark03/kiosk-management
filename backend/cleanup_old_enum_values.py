#!/usr/bin/env python3
"""
Script to clean up old enum values from videos table
Removes RUNWAY_GENERATED and VEO_GENERATED (unified to AI_GENERATED)
"""

import pymysql
import sys
import os

# Database connection from environment variables
DB_HOST = os.getenv("DB_HOST", "kiosk-db.cj0k46yy6vv6.ap-northeast-2.rds.amazonaws.com")
DB_USER = os.getenv("DB_USERNAME", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME", "kioskdb")

def main():
    if not DB_PASSWORD:
        print("Error: DB_PASSWORD environment variable is required")
        print("Usage: DB_PASSWORD=your_password python3 cleanup_old_enum_values.py")
        sys.exit(1)

    try:
        # Connect to database
        print(f"Connecting to database {DB_NAME} at {DB_HOST}...")
        connection = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )

        with connection:
            with connection.cursor() as cursor:
                # Check count of old enum videos
                print("\n=== Checking Old Enum Values ===")
                sql = """
                    SELECT COUNT(*) as count, video_type
                    FROM videos
                    WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED')
                    GROUP BY video_type
                """
                cursor.execute(sql)
                results = cursor.fetchall()

                if not results:
                    print("✓ No old enum values found. Database is clean!")

                    # Show current video types
                    print("\n=== Current Video Types ===")
                    sql = """
                        SELECT video_type, COUNT(*) as count
                        FROM videos
                        GROUP BY video_type
                    """
                    cursor.execute(sql)
                    current_types = cursor.fetchall()
                    for row in current_types:
                        print(f"  {row['video_type']}: {row['count']} videos")
                    return

                total_count = 0
                for row in results:
                    print(f"  {row['video_type']}: {row['count']} videos")
                    total_count += row['count']

                print(f"\n⚠ Total old enum videos to delete: {total_count}")

                # Show details
                print("\n=== Video Details ===")
                sql = """
                    SELECT id, title, video_type, media_type, original_filename, uploaded_at
                    FROM videos
                    WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED')
                    ORDER BY id
                """
                cursor.execute(sql)
                videos = cursor.fetchall()

                for video in videos:
                    print(f"  ID: {video['id']}, Type: {video['video_type']}, "
                          f"Media: {video['media_type']}, Title: {video['title']}")

                # Confirm deletion
                print(f"\n=== Delete {total_count} old enum videos? ===")
                confirm = input("Type 'yes' to confirm deletion: ")

                if confirm.lower() == 'yes':
                    # Delete old enum videos (NOT AI_GENERATED - it's still in use!)
                    sql = """
                        DELETE FROM videos
                        WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED')
                    """
                    cursor.execute(sql)
                    connection.commit()

                    deleted_count = cursor.rowcount
                    print(f"\n✓ Successfully deleted {deleted_count} old enum videos")

                    # Verify deletion
                    sql = """
                        SELECT COUNT(*) as count
                        FROM videos
                        WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED')
                    """
                    cursor.execute(sql)
                    result = cursor.fetchone()
                    print(f"✓ Remaining old enum videos: {result['count']}")

                    # Show current state
                    print("\n=== Current Video Types ===")
                    sql = """
                        SELECT video_type, COUNT(*) as count
                        FROM videos
                        GROUP BY video_type
                    """
                    cursor.execute(sql)
                    current_types = cursor.fetchall()
                    for row in current_types:
                        print(f"  {row['video_type']}: {row['count']} videos")
                else:
                    print("\n✗ Deletion cancelled")

    except pymysql.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
