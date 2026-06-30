export const inviteUser = async (req, res) => {
  try {

  } catch (error) {
    console.error("Invite User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
    });
  }
};