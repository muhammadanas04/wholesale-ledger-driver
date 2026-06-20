This app will be given to drivers so that they can receive orders on it which are sent through admin app.

# Features
- Drivers can view orders here
- Orders can be marked as done or rejected
- Share location through this app to admin app
- Share details of their expenses to admin app

# Login
- Driver account will be created on admin app by adding their name and phone number. This will generate an OTP.
- Drivers can login into the app by sharing their phone number(which will act as username) and typing the OTP generated in the admin app.
- It will be a one time login which means they do not need to enter these details every time they open the app.
- They will be automatically logged out after 30 days of not receiving any orders. In this case, to login again, they need another OTP from the admin app.

# Orders
- Admin can send order, which are to be delivered, to the drivers by creating one or many deliveries at once.
- A delivery will contain customer name, phone number, address, order details - qty, weight, total price. any of the field can be empty except qty.
- Driver will receive the list of deliveries which he can mark as done or rejected based on the completion of the order.
- Driver can also edit the order details - like qty or weight.
- All of these changes - Done/Rejected/Edited - will be shown in the admin app.
- There can be a progress bar for the orders.
- There can be a section too in the app to record the history of completed orders.

# Live location
- Driver's live location can viewed by the admin in admin app.
- When driver opens their app, it is mandatory for them to turn on their location or the app won't work.
- Details of this feature can be found in the file LEAFLET_OSM_PLAN.md which is in here - /home/anas/Development/Projects/wholesale-mobile-app/admin-app/LEAFLET_OSM_PLAN.md
- This feature will be implemented later, so, we can prepare the ground for it now but do not implement the feature yet.

# Stock
- Driver can add the amount of stock they are carrying
- The stock should get updated as the orders complete. If the orders are marked done then subtract the amount (qty and/or weight) from the stock equivalent to the order completed.
- There is only one type of item the driver will be carrying so no need to add option for different type of items

# Report Expenses
- Drivers can send their expense report to the admin which will these things:
	- An image (Required) - No option to select image from gallery, just click it and send it
	- Amount (Required) - Price or Quantity
	- Note (Optional)
- We can use firebase for this. (Tell me what external setup will be required)
- We can have the following category for the reports:
	- Petrol/Diesel (for this, Amount = Price)
	- Repair (Amount = Price)
	- Defective item (Amount = Quantity)
	- Other (Amount = Price)

The app should be simple and very easy to use. Design the layouts as if it will be used by 10-12 year old kids

The UI should follow the theme of admin app.